"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type { ChatMessage, ToolUseBlock } from "@/hooks/useClaudeChat";
import type { ResultMeta } from "@/hooks/useClaudeSession";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const NAMESPACE = "/agents/claude";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

// ─── 서버 응답 타입 ────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  title: string;
  claudeSessionId?: string | null;
  status?: string;
  workingDirectory?: string;
  createdAt: string;
}

/** GET /sessions 응답 */
interface DBSession {
  sessionId: string;
  title: string;
  createdAt: string;
}

/** GET /conversations/session/:id 응답 */
interface DBConversation {
  id: string;
  sessionId: string;
  promptId: string;
  content: string;
  agentModel: string;
  type: "user_message" | "agent_message";
  createdAt: string;
}

// ─── 세션 상태 ────────────────────────────────────────────────────────────────

export interface SessionState {
  info: SessionInfo;
  messages: ChatMessage[];
  streaming: string;
  isWaiting: boolean;
  /** DB에서 대화 기록을 불러왔는지 여부 */
  messagesLoaded: boolean;
}

let msgId = 0;
const nextId = () => String(++msgId);

// ─── Conversation 저장 헬퍼 ──────────────────────────────────────────────────

type ConversationType = "user_message" | "agent_message";

function saveConversation(
  sessionId: string,
  promptId: string,
  content: string,
  type: ConversationType,
): void {
  void fetch(`${SERVER_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, promptId, content, agentModel: "claude", type }),
  }).catch(() => undefined);
}

// ─── DB Conversation → ChatMessage 변환 ──────────────────────────────────────

function toMessages(convos: DBConversation[]): ChatMessage[] {
  return convos.map((c) => ({
    id: c.id,
    role: c.type === "user_message" ? "user" : "assistant",
    content: c.content,
    createdAt: new Date(c.createdAt),
  }));
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
  const pendingPromptIdRef = useRef<Record<string, string>>({});
  /** 이미 대화 로딩을 시작한 세션 ID 집합 (중복 요청 방지) */
  const loadingSessionsRef = useRef<Set<string>>(new Set());

  // ─── DB에서 세션 목록 로드 ─────────────────────────────────────────────────

  const loadSessionsFromDB = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/sessions`);
      if (!res.ok) return;
      const dbSessions: DBSession[] = await res.json();

      setSessions((prev) => {
        const existingIds = new Set(prev.map((s) => s.info.id));
        const newStates: SessionState[] = dbSessions
          .filter((s) => !existingIds.has(s.sessionId))
          .map((s) => ({
            info: { id: s.sessionId, title: s.title, createdAt: s.createdAt },
            messages: [],
            streaming: "",
            isWaiting: false,
            messagesLoaded: false,
          }));
        // DB 세션이 맨 앞에 오고 (최신순), 이미 있는 세션은 유지
        return [...prev, ...newStates].sort(
          (a, b) => new Date(b.info.createdAt).getTime() - new Date(a.info.createdAt).getTime(),
        );
      });
    } catch {
      // 세션 로드 실패 무시
    }
  }, []);

  // ─── 특정 세션의 대화 기록 로드 ───────────────────────────────────────────

  const loadConversations = useCallback(async (sessionId: string) => {
    if (loadingSessionsRef.current.has(sessionId)) return;
    loadingSessionsRef.current.add(sessionId);

    try {
      const res = await fetch(`${SERVER_URL}/conversations/session/${sessionId}`);
      if (!res.ok) return;
      const convos: DBConversation[] = await res.json();
      const messages = toMessages(convos);

      setSessions((prev) =>
        prev.map((s) =>
          s.info.id === sessionId ? { ...s, messages, messagesLoaded: true } : s,
        ),
      );
    } catch {
      // 로드 실패 시 빈 상태로 처리
      setSessions((prev) =>
        prev.map((s) => (s.info.id === sessionId ? { ...s, messagesLoaded: true } : s)),
      );
    }
  }, []);

  // ─── WebSocket (스트리밍 이벤트 수신 전용) ───────────────────────────────

  useEffect(() => {
    const socket = io(`${SERVER_URL}${NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;
    setConnectionStatus("connecting");

    socket.on("connect", () => {
      setConnectionStatus("connected");
      // 연결 직후 DB 세션 목록 동기화
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

        // 동일 promptId로 agent_message 저장 (1:1 매핑)
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
  }, [loadSessionsFromDB]);

  // ─── 세션 선택 시 대화 기록 자동 로드 ────────────────────────────────────

  useEffect(() => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.info.id === selectedSessionId);
    if (!session || session.messagesLoaded) return;
    void loadConversations(selectedSessionId);
  }, [selectedSessionId, sessions, loadConversations]);

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
      const raw = await res.json();
      // 서버 반환값(workingDirectory 기반)으로 title 생성
      const title = raw.workingDirectory
        ? raw.workingDirectory.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean).at(-1) ?? "새 세션"
        : "새 세션";

      const newState: SessionState = {
        info: { id: raw.id, title, createdAt: raw.createdAt, ...raw },
        messages: [],
        streaming: "",
        isWaiting: false,
        messagesLoaded: true, // 새 세션은 기록 없음
      };

      setSessions((prev) => [newState, ...prev]);
      setSelectedSessionId(raw.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 생성 실패");
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
