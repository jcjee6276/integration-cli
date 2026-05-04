"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { io, type Socket } from "socket.io-client";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const NAMESPACE = "/agents/claude";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface SessionInfo {
  id: string;
  status: string;
  workingDirectory: string;
  createdAt: string;
}

interface UseClaudeSessionOptions {
  onOutput?: (data: string) => void;
  onExit?: (exitCode: number) => void;
}

export function useClaudeSession({ onOutput, onExit }: UseClaudeSessionOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onOutputRef = useRef(onOutput);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onOutputRef.current = onOutput;
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
      socket.emit("session:subscribe", { sessionId: info.id });
    });

    socket.on("session:output", ({ data }: { data: string }) => {
      onOutputRef.current?.(data);
    });

    socket.on("session:exit", ({ exitCode }: { exitCode: number }) => {
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

  const sendInput = useCallback((input: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    socketRef.current?.emit("session:input", { sessionId, input });
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    socketRef.current?.emit("session:resize", { sessionId, cols, rows });
  }, []);

  const terminateSession = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    socketRef.current?.emit("session:terminate", { sessionId });
    setSession(null);
    sessionIdRef.current = null;
  }, []);

  return {
    connectionStatus,
    session,
    error,
    createSession,
    sendInput,
    resize,
    terminateSession,
  };
}
