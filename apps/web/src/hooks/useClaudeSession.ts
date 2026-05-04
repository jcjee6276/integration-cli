"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { io, type Socket } from "socket.io-client";

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

export interface ToolUse {
  tool: string;
  input: Record<string, unknown>;
}

export interface ResultMeta {
  result: string;
  isError: boolean;
  durationMs: number;
  costUsd: number;
}

interface UseClaudeSessionOptions {
  onText?: (text: string) => void;
  onTool?: (toolUse: ToolUse) => void;
  onResult?: (meta: ResultMeta) => void;
  onExit?: (exitCode: number) => void;
}

export function useClaudeSession({
  onText,
  onTool,
  onResult,
  onExit,
}: UseClaudeSessionOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTextRef = useRef(onText);
  const onToolRef = useRef(onTool);
  const onResultRef = useRef(onResult);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onTextRef.current = onText;
    onToolRef.current = onTool;
    onResultRef.current = onResult;
    onExitRef.current = onExit;
  });

  useEffect(() => {
    const socket = io(`${SERVER_URL}${NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;
    setConnectionStatus("connecting");

    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      setSession(null);
      sessionIdRef.current = null;
    });

    socket.on("session:created", (info: SessionInfo) => {
      setSession(info);
      sessionIdRef.current = info.id;
    });

    // 텍스트 스트리밍 델타
    socket.on("session:text", ({ text }: { sessionId: string; text: string }) => {
      onTextRef.current?.(text);
    });

    // 도구 사용 알림
    socket.on("session:tool", ({ tool, input }: { sessionId: string; tool: string; input: Record<string, unknown> }) => {
      onToolRef.current?.({ tool, input });
    });

    // 응답 완료
    socket.on("session:result", (meta: { sessionId: string } & ResultMeta) => {
      onResultRef.current?.(meta);
    });

    // 프로세스 종료
    socket.on("session:exit", ({ exitCode }: { sessionId: string; exitCode: number }) => {
      setSession(null);
      sessionIdRef.current = null;
      onExitRef.current?.(exitCode);
    });

    socket.on("error", ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createSession = useCallback((workingDirectory?: string) => {
    setError(null);
    socketRef.current?.emit("session:create", { workingDirectory });
  }, []);

  const sendMessage = useCallback((message: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    socketRef.current?.emit("session:message", { sessionId, input: message });
  }, []);

  const terminateSession = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    socketRef.current?.emit("session:terminate", { sessionId });
    setSession(null);
    sessionIdRef.current = null;
  }, []);

  return { connectionStatus, session, error, createSession, sendMessage, terminateSession };
}
