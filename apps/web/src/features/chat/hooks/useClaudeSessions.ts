"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { CLAUDE_WS_NAMESPACE, SERVER_URL } from "@/lib/constants";
import {
  createSession as apiCreateSession,
  deleteSession,
  fetchConversations,
  fetchDBSessions,
  saveConversation,
  updateSessionTitle,
} from "../api/sessions.api";
import type { DBConversation, SessionInfo } from "../api/sessions.api";
import type { AgentId } from "../ui/AgentSelectModal";

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type MessageRole = "user" | "assistant" | "permission" | "system";

export interface ToolUseBlock {
  tool: string;
  input: Record<string, unknown>;
}

export interface ResultMeta {
  result: string;
  isError: boolean;
  durationMs: number;
  costUsd: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolUses?: ToolUseBlock[];
  meta?: ResultMeta;
  createdAt: Date;
}

export interface SessionState {
  info: SessionInfo;
  messages: ChatMessage[];
  streaming: string;
  isWaiting: boolean;
  messagesLoaded: boolean;
  agentId: AgentId;
}

export type { AgentId };

export { SessionInfo };

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

let msgId = 0;
const nextId = () => String(++msgId);

function toMessages(convos: DBConversation[]): ChatMessage[] {
  return convos.map((c) => ({
    id: c.id,
    role: c.type === "user_message" ? "user" : "assistant",
    content: c.content,
    createdAt: new Date(c.createdAt),
  }));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useClaudeSessions() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamingRef = useRef<Record<string, string>>({});
  const pendingToolsRef = useRef<Record<string, ToolUseBlock[]>>({});
  const pendingPromptIdRef = useRef<Record<string, string>>({});
  const loadingSessionsRef = useRef<Set<string>>(new Set());

  // ─── DB 세션 로드 ──────────────────────────────────────────────────────────

  const loadSessionsFromDB = useCallback(async () => {
    try {
      const dbSessions = await fetchDBSessions('claude');
      setSessions((prev) => {
        const existingIds = new Set(prev.map((s) => s.info.id));
        const newStates: SessionState[] = dbSessions
          .filter((s) => !existingIds.has(s.sessionId))
          .map((s) => ({
            info: { id: s.sessionId, title: !s.title || s.title === "server" ? "Claude" : s.title, createdAt: s.createdAt },
            messages: [],
            streaming: "",
            isWaiting: false,
            messagesLoaded: false,
            agentId: "claude" as AgentId,
          }));
        return [...prev, ...newStates].sort(
          (a, b) => new Date(b.info.createdAt).getTime() - new Date(a.info.createdAt).getTime(),
        );
      });
    } catch {}
  }, []);

  // ─── 대화 기록 로드 ────────────────────────────────────────────────────────

  const loadConversations = useCallback(async (sessionId: string) => {
    if (loadingSessionsRef.current.has(sessionId)) return;
    loadingSessionsRef.current.add(sessionId);
    try {
      const convos = await fetchConversations(sessionId);
      setSessions((prev) =>
        prev.map((s) =>
          s.info.id === sessionId ? { ...s, messages: toMessages(convos), messagesLoaded: true } : s,
        ),
      );
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.info.id === sessionId ? { ...s, messagesLoaded: true } : s)),
      );
    }
  }, []);

  // ─── WebSocket ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(`${SERVER_URL}${CLAUDE_WS_NAMESPACE}`, { transports: ["websocket"] });
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

    socket.on(
      "session:tool",
      ({ sessionId, tool, input }: { sessionId: string; tool: string; input: Record<string, unknown> }) => {
        if (!pendingToolsRef.current[sessionId]) pendingToolsRef.current[sessionId] = [];
        pendingToolsRef.current[sessionId].push({ tool, input });
      },
    );

    socket.on(
      "session:result",
      ({ sessionId, result, isError, durationMs, costUsd }: { sessionId: string } & ResultMeta) => {
        const content = (streamingRef.current[sessionId] ?? "").trim();
        const toolUses = pendingToolsRef.current[sessionId] ?? [];
        streamingRef.current[sessionId] = "";
        pendingToolsRef.current[sessionId] = [];

        const promptId = pendingPromptIdRef.current[sessionId];
        if (promptId && content) {
          saveConversation(sessionId, promptId, content, "agent_message");
          delete pendingPromptIdRef.current[sessionId];
        }

        setSessions((prev) =>
          prev.map((s) => {
            if (s.info.id !== sessionId) return s;
            const newMessages = [...s.messages];
            if (content || toolUses.length > 0) {
              newMessages.push({
                id: nextId(),
                role: "assistant",
                content,
                toolUses: toolUses.length > 0 ? toolUses : undefined,
                meta: { result, isError, durationMs, costUsd },
                createdAt: new Date(),
              });
            }
            return { ...s, messages: newMessages, streaming: "", isWaiting: false };
          }),
        );
      },
    );

    socket.on("session:exit", ({ sessionId }: { sessionId: string }) => {
      streamingRef.current[sessionId] = "";
      pendingToolsRef.current[sessionId] = [];
      setSessions((prev) =>
        prev.map((s) => (s.info.id === sessionId ? { ...s, streaming: "", isWaiting: false } : s)),
      );
    });

    socket.on("error", ({ message }: { message: string }) => setError(message));

    return () => { socket.disconnect(); };
  }, [loadSessionsFromDB]);

  // ─── 세션 선택 시 대화 기록 로드 ─────────────────────────────────────────

  useEffect(() => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.info.id === selectedSessionId);
    if (!session || session.messagesLoaded) return;
    void loadConversations(selectedSessionId);
  }, [selectedSessionId, sessions, loadConversations]);

  // ─── 공개 API ─────────────────────────────────────────────────────────────

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.info.id === sessionId ? { ...s, info: { ...s.info, title: newTitle } } : s,
      ),
    );
    void updateSessionTitle(sessionId, newTitle).catch(() => undefined);
  }, []);

  const createSession = useCallback(async (agentId: AgentId, workingDirectory?: string): Promise<string | null> => {
    setError(null);
    try {
      const raw = await apiCreateSession(workingDirectory);
      const title = raw.workingDirectory
        ? raw.workingDirectory.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean).at(-1) ?? "Claude"
        : "Claude";

      const newState: SessionState = {
        info: { ...raw, title },
        messages: [],
        streaming: "",
        isWaiting: false,
        messagesLoaded: true,
        agentId,
      };

      setSessions((prev) => [newState, ...prev]);
      setSelectedSessionId(raw.id);
      return raw.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "세션 생성 실패");
      return null;
    }
  }, []);

  const sendMessage = useCallback((sessionId: string, text: string) => {
    const promptId = crypto.randomUUID();
    pendingPromptIdRef.current[sessionId] = promptId;

    setSessions((prev) =>
      prev.map((s) =>
        s.info.id === sessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                { id: nextId(), role: "user", content: text, createdAt: new Date() },
              ],
              isWaiting: true,
            }
          : s,
      ),
    );

    saveConversation(sessionId, promptId, text, "user_message");
    socketRef.current?.emit("session:message", { sessionId, input: text });
  }, []);

  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.info.id !== sessionId));
      setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 삭제 실패");
    }
  }, []);

  const injectMessage = useCallback(
    (sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.info.id === sessionId
            ? { ...s, messages: [...s.messages, { ...message, id: nextId(), createdAt: new Date() }] }
            : s,
        ),
      );
    },
    [],
  );

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
    injectMessage,
    renameSession,
  };
}
