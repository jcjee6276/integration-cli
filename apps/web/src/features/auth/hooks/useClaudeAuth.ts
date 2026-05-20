"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { CLAUDE_WS_NAMESPACE, SERVER_URL } from "@/lib/constants";
import { getAuthStatus } from "../api/auth.api";

export type AuthState = "checking" | "authenticated" | "unauthenticated";
export type LoginState = "idle" | "pending" | "done" | "error";

const URL_REGEX = /https?:\/\/[^\s\-"<>\\^`{|}~]+/g;

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_REGEX) ?? []));
}

export function useClaudeAuth() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [loginOutput, setLoginOutput] = useState("");
  const [loginUrls, setLoginUrls] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef("");
  const isLoginActiveRef = useRef(false);

  const checkAuth = useCallback(async () => {
    setAuthState("checking");
    try {
      const data = await getAuthStatus();
      setAuthState(data.loggedIn ? "authenticated" : "unauthenticated");
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => { void checkAuth(); }, [checkAuth]);

  const startLogin = useCallback(() => {
    if (loginState === "pending") return;

    outputRef.current = "";
    setLoginOutput("");
    setLoginUrls([]);
    setLoginState("pending");
    isLoginActiveRef.current = true;

    const socket = io(`${SERVER_URL}${CLAUDE_WS_NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("auth:login:start"));

    socket.on("auth:output", ({ text }: { text: string }) => {
      outputRef.current += text;
      setLoginOutput(outputRef.current);
      setLoginUrls(extractUrls(outputRef.current));
    });

    socket.on("auth:done", ({ success }: { success: boolean }) => {
      isLoginActiveRef.current = false;
      socket.disconnect();
      socketRef.current = null;
      setLoginState(success ? "done" : "error");
      if (success) setAuthState("authenticated");
    });

    socket.on("disconnect", () => {
      if (isLoginActiveRef.current) {
        isLoginActiveRef.current = false;
        setLoginState("error");
      }
    });
  }, [loginState]);

  const cancelLogin = useCallback(() => {
    isLoginActiveRef.current = false;
    socketRef.current?.emit("auth:login:cancel");
    socketRef.current?.disconnect();
    socketRef.current = null;
    setLoginState("idle");
    setLoginOutput("");
    setLoginUrls([]);
    outputRef.current = "";
  }, []);

  return { authState, loginState, loginOutput, loginUrls, startLogin, cancelLogin, checkAuth };
}
