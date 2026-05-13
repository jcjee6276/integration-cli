"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type { ChatMessage, ToolUseBlock } from "@/hooks/useClaudeChat";
import type { ResultMeta } from "@/hooks/useClaudeSession";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const NAMESPACE = "/agents/claude";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface SessionInfo {
  id: string;
  claudeSessionId: string | null;
  status: string;
  workingDirectory: string;
  createdAt: string;
}

export interface SessionState {
  info: SessionInfo;
  messages: ChatMessage[];
  streaming: string;
  isWaiting: boolean;
}

let msgId = 0;
const nextId = () => String(++msgId);

// ─── Conversation API ────────────────────────────────────────────────────────

type ConversationType = "user_message" | "agent_message";

function saveConversation(
  agentSessionId: string,
  promptId: string,
  content: string,
  type: ConversationType,
): void {
  void fetch(`${SERVER_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: agentSessionId,
      promptId,
      content,
      agentModel: "claude",
      type,
    }),
  }).catch(() => {
    // 대화 저장 실패는 무시 (채팅 UX에 영향 없음)
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function useClaudeSessions() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamingRef = useRef<Record<string, string>>({});
  const pendingToolsRef = useRef<Record<string, ToolUseBlock[]>>({});
  /** 메시지 전송 시 생성된 promptId — 응답 수신 시 1:1 매핑에 사용 */
  const pendingPromptIdRef = useRef<Record<string, string>>({});

  // ─── WebSocket (스트리밍 이벤트 수신 전용) ───────────────────────────────
  useEffect(() => {
    const socket = io(`${SERVER_URL}${NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;
    setConnectionStatus("connecting");

    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));

    socket.on("session:text", ({ sessionId, text }: { sessionId: string; text: string }) => {
      streamingRef.current[sessionId] = (streamingRef.current[sessionId] ?? "") + text;
      const accumulated = streamingRef.current[sessionId];
      setSessions((prev) =>
        prev.map((s) => (s.info.id === sessionId ? { ...s, streaming: accumulated, isWaiting: true } : s)),
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
      ({
        sessionId,
        result,
        isError,
        durationMs,
        costUsd,
      }: { sessionId: string } & ResultMeta) => {
        const content = (streamingRef.current[sessionId] ?? "").trim();
        const toolUses = pendingToolsRef.current[sessionId] ?? [];
        streamingRef.current[sessionId] = "";
        pendingToolsRef.current[sessionId] = [];

        // 동일 promptId로 agent_message 저장 (user_message와 1:1 매핑)
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

    return () => {
      socket.disconnect();
    };
  }, []);

  // ─── REST API ─────────────────────────────────────────────────────────────

  const createSession = useCallback(async (workingDirectory?: string) => {
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/agents/claude/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workingDirectory ? { workingDirectory } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info: SessionInfo = await res.json();
      setSessions((prev) => [...prev, { info, messages: [], streaming: "", isWaiting: false }]);
      setSelectedSessionId(info.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 생성 실패");
    }
  }, []);

  const sendMessage = useCallback((sessionId: string, text: string) => {
    // promptId 생성 — user_message와 agent_message를 1:1로 연결하는 키
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

    // user_message DB 저장
    saveConversation(sessionId, promptId, text, "user_message");

    socketRef.current?.emit("session:message", { sessionId, input: text });
  }, []);

  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`${SERVER_URL}/agents/claude/sessions/${sessionId}`, { method: "DELETE" });
    } catch {}
    setSessions((prev) => prev.filter((s) => s.info.id !== sessionId));
    setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
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
  };
}
