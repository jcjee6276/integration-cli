"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { GEMINI_WS_NAMESPACE, SERVER_URL } from "@/lib/constants";
import { configureGeminiAuth, getGeminiAuthStatus } from "../api/auth.api";

export type GeminiAuthState = "checking" | "authenticated" | "unauthenticated" | "not-installed";
export type GeminiLoginState = "idle" | "pending" | "done" | "error";
export type GeminiAuthMethod = "api-key" | "gca";

const URL_REGEX = /https?:\/\/[^\s\-"<>\\^`{|}~]+/g;

function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_REGEX) ?? []));
}

export function useGeminiAuth() {
  const [authState, setAuthState] = useState<GeminiAuthState>("checking");
  const [loginState, setLoginState] = useState<GeminiLoginState>("idle");
  const [loginOutput, setLoginOutput] = useState("");
  const [loginUrls, setLoginUrls] = useState<string[]>([]);
  const [configError, setConfigError] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef("");
  const isLoginActiveRef = useRef(false);

  const checkAuth = useCallback(async () => {
    setAuthState("checking");
    try {
      const data = await getGeminiAuthStatus();
      if (!data.installed) setAuthState("not-installed");
      else setAuthState(data.loggedIn ? "authenticated" : "unauthenticated");
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => { void checkAuth(); }, [checkAuth]);

  // ── API Key 방식 ────────────────────────────────────────────────────────────
  const saveApiKey = useCallback(async (apiKey: string) => {
    setConfigError("");
    setLoginState("pending");
    try {
      await configureGeminiAuth("api-key", apiKey);
      setLoginState("done");
      setAuthState("authenticated");
    } catch {
      setConfigError("API 키 저장에 실패했습니다. 서버 연결을 확인하세요.");
      setLoginState("error");
    }
  }, []);

  // ── GCA 방식 (gcloud auth application-default login) ────────────────────────
  const startGcaLogin = useCallback(() => {
    if (loginState === "pending") return;

    outputRef.current = "";
    setLoginOutput("");
    setLoginUrls([]);
    setLoginState("pending");
    isLoginActiveRef.current = true;

    const socket = io(`${SERVER_URL}${GEMINI_WS_NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("auth:gca:start"));

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

  const resetLogin = useCallback(() => {
    setLoginState("idle");
    setLoginOutput("");
    setLoginUrls([]);
    setConfigError("");
    outputRef.current = "";
  }, []);

  return {
    authState,
    loginState,
    loginOutput,
    loginUrls,
    configError,
    saveApiKey,
    startGcaLogin,
    cancelLogin,
    resetLogin,
    checkAuth,
  };
}
