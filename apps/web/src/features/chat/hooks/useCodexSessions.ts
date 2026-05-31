"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { CODEX_WS_NAMESPACE, SERVER_URL } from "@/lib/constants";
import {
  createCodexSession as apiCreateSession,
  deleteCodexSession,
  fetchConversations,
  fetchDBSessions,
  saveCodexConversation,
  updateSessionTitle,
} from "../api/sessions.api";
import type { DBConversation, SessionInfo } from "../api/sessions.api";
import type { AgentModelSettings } from "../lib/agentModelOptions";
import type { ChatMessage, ResultMeta, SessionState } from "./useClaudeSessions";

export type { SessionInfo };

let msgId = 0;
const nextId = () => String(++msgId);

function toMessages(convos: DBConversation[]): ChatMessage[] {
  return convos.map((c) => ({
    id: c.id,
    role: (c.type === "user_message" ? "user" : "assistant") as ChatMessage["role"],
    content: c.content,
    createdAt: new Date(c.createdAt),
  }));
}

export function useCodexSessions() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamingRef = useRef<Record<string, string>>({});
  const pendingPromptIdRef = useRef<Record<string, string>>({});
  const pendingUserMsgRef = useRef<Record<string, { promptId: string; content: string }>>({});
  const loadingSessionsRef = useRef<Set<string>>(new Set());

  const loadSessionsFromDB = useCallback(async () => {
    try {
      const dbSessions = await fetchDBSessions("codex");
      setSessions((prev) => {
        const existingIds = new Set(prev.map((s) => s.info.id));
        const newStates: SessionState[] = dbSessions
          .filter((s) => !existingIds.has(s.sessionId))
          .map((s) => ({
            info: { id: s.sessionId, title: !s.title || s.title === "server" ? "Codex" : s.title, createdAt: s.createdAt },
            messages: [],
            streaming: "",
            isWaiting: false,
            messagesLoaded: false,
            agentId: "codex" as const,
          }));
        return [...prev, ...newStates].sort(
          (a, b) => new Date(b.info.createdAt).getTime() - new Date(a.info.createdAt).getTime(),
        );
      });
    } catch {}
  }, []);

  const loadConversations = useCallback(async (sessionId: string) => {
    if (loadingSessionsRef.current.has(sessionId)) return;
    loadingSessionsRef.current.add(sessionId);
    try {
      const convos = await fetchConversations(sessionId);
      const codexConvos = convos.filter((c) => c.agentModel === "codex");
      setSessions((prev) =>
        prev.map((s) =>
          s.info.id === sessionId
            ? { ...s, messages: toMessages(codexConvos), messagesLoaded: true }
            : s,
        ),
      );
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.info.id === sessionId ? { ...s, messagesLoaded: true } : s)),
      );
    }
  }, []);

  useEffect(() => {
    const socket = io(`${SERVER_URL}${CODEX_WS_NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;
    setConnectionStatus("connecting");

    socket.on("connect", () => {
      setConnectionStatus("connected");
      void loadSessionsFromDB();
    });

    socket.on("disconnect", () => setConnectionStatus("disconnected"));

    socket.on("session:text", ({ sessionId, text }: { sessionId: string; text: string }) => {
      streamingRef.current[sessionId] = (streamingRef.current[sessionId] ?? "") + text;
      const accumulated = streamingRef.current[sessionId];
      setSessions((prev) =>
        prev.map((s) =>
          s.info.id === sessionId ? { ...s, streaming: accumulated, isWaiting: true } : s,
        ),
      );
    });

    socket.on("session:result", ({ sessionId, isError }: { sessionId: string; isError: boolean }) => {
      const content = (streamingRef.current[sessionId] ?? "").trim();
      streamingRef.current[sessionId] = "";

      const promptId = pendingPromptIdRef.current[sessionId];
      const userMsg = pendingUserMsgRef.current[sessionId];
      if (promptId) {
        if (userMsg) {
          saveCodexConversation(sessionId, userMsg.promptId, userMsg.content, "user_message");
          delete pendingUserMsgRef.current[sessionId];
        }
        if (content) {
          saveCodexConversation(sessionId, promptId, content, "agent_message");
        }
        delete pendingPromptIdRef.current[sessionId];
      }

      const meta: ResultMeta = { result: "", isError, durationMs: 0, costUsd: 0 };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.info.id !== sessionId) return s;
          const newMessages = [...s.messages];
          if (content) {
            newMessages.push({
              id: nextId(),
              role: "assistant",
              content,
              meta,
              createdAt: new Date(),
            });
          }
          return { ...s, messages: newMessages, streaming: "", isWaiting: false };
        }),
      );
    });

    socket.on("session:exit", ({ sessionId }: { sessionId: string }) => {
      streamingRef.current[sessionId] = "";
      setSessions((prev) =>
        prev.map((s) => (s.info.id === sessionId ? { ...s, streaming: "", isWaiting: false } : s)),
      );
    });

    socket.on("session:replaced", ({ oldSessionId, newSessionId }: { oldSessionId: string; newSessionId: string }) => {
      if (streamingRef.current[oldSessionId] !== undefined) {
        streamingRef.current[newSessionId] = streamingRef.current[oldSessionId];
        delete streamingRef.current[oldSessionId];
      }
      if (pendingPromptIdRef.current[oldSessionId] !== undefined) {
        pendingPromptIdRef.current[newSessionId] = pendingPromptIdRef.current[oldSessionId];
        delete pendingPromptIdRef.current[oldSessionId];
      }
      if (pendingUserMsgRef.current[oldSessionId] !== undefined) {
        pendingUserMsgRef.current[newSessionId] = pendingUserMsgRef.current[oldSessionId];
        delete pendingUserMsgRef.current[oldSessionId];
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.info.id === oldSessionId ? { ...s, info: { ...s.info, id: newSessionId } } : s,
        ),
      );
      setSelectedSessionId((prev) => (prev === oldSessionId ? newSessionId : prev));
    });

    socket.on("error", ({ message }: { message: string }) => setError(message));

    return () => { socket.disconnect(); };
  }, [loadSessionsFromDB]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.info.id === selectedSessionId);
    if (!session || session.messagesLoaded) return;
    void loadConversations(selectedSessionId);
  }, [selectedSessionId, sessions, loadConversations]);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.info.id === sessionId ? { ...s, info: { ...s.info, title: newTitle } } : s,
      ),
    );
    void updateSessionTitle(sessionId, newTitle).catch(() => undefined);
  }, []);

  const createSession = useCallback(async (
    workingDirectory?: string,
    modelSettings?: AgentModelSettings,
  ): Promise<string | null> => {
    setError(null);
    try {
      const raw = await apiCreateSession({ workingDirectory, ...modelSettings });
      const title = raw.workingDirectory
        ? raw.workingDirectory.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean).at(-1) ?? "Codex"
        : "Codex";

      const newState: SessionState = {
        info: { ...raw, title },
        messages: [],
        streaming: "",
        isWaiting: false,
        messagesLoaded: true,
        agentId: "codex",
      };

      setSessions((prev) => [newState, ...prev]);
      setSelectedSessionId(raw.id);
      return raw.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Codex 세션 생성 실패");
      return null;
    }
  }, []);

  const sendMessage = useCallback((sessionId: string, text: string, modelSettings?: AgentModelSettings) => {
    const promptId = crypto.randomUUID();
    pendingPromptIdRef.current[sessionId] = promptId;
    pendingUserMsgRef.current[sessionId] = { promptId, content: text };

    setSessions((prev) =>
      prev.map((s) =>
        s.info.id === sessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                { id: nextId(), role: "user" as const, content: text, createdAt: new Date() },
              ],
              isWaiting: true,
            }
          : s,
      ),
    );

    socketRef.current?.emit("session:message", {
      sessionId,
      input: text,
      ...modelSettings,
    });
  }, []);

  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      await deleteCodexSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.info.id !== sessionId));
      setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 삭제 실패");
    }
  }, []);

  const selectedSession = sessions.find((s) => s.info.id === selectedSessionId) ?? null;

  return {
    connectionStatus,
    sessions,
    selectedSession,
    selectedSessionId,
    error,
    createSession,
    selectSession: setSelectedSessionId,
    sendMessage,
    terminateSession,
    renameSession,
  };
}
