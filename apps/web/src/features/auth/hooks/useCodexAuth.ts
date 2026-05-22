"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { CODEX_WS_NAMESPACE, SERVER_URL } from "@/lib/constants";
import { configureCodexAuth, getCodexAuthStatus } from "../api/auth.api";

export type CodexAuthState = "checking" | "authenticated" | "unauthenticated" | "not-installed";
export type CodexLoginState = "idle" | "pending" | "done" | "error";
export type CodexLoginMethod = "device" | "apikey";

const URL_REGEX = /https?:\/\/[\w./-]+/g;
const CODE_REGEX = /(?<![A-Z0-9])([A-Z0-9]{4}-[A-Z0-9]{4,6})(?![A-Z0-9])/;

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_REGEX) ?? []));
}

export function extractDeviceCode(text: string): string | null {
  return text.match(CODE_REGEX)?.[1] ?? null;
}

export function useCodexAuth() {
  const [authState, setAuthState] = useState<CodexAuthState>("checking");
  const [loginMethod, setLoginMethod] = useState<CodexLoginMethod>("device");

  // device auth state
  const [loginState, setLoginState] = useState<CodexLoginState>("idle");
  const [loginOutput, setLoginOutput] = useState("");
  const [loginUrls, setLoginUrls] = useState<string[]>([]);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);

  // api key state
  const [apiKeyLoginState, setApiKeyLoginState] = useState<CodexLoginState>("idle");
  const [configError, setConfigError] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const outputRef = useRef("");
  const isLoginActiveRef = useRef(false);

  const checkAuth = useCallback(async () => {
    setAuthState("checking");
    try {
      const data = await getCodexAuthStatus();
      if (!data.installed) setAuthState("not-installed");
      else setAuthState(data.loggedIn ? "authenticated" : "unauthenticated");
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => { void checkAuth(); }, [checkAuth]);

  // ── Device auth (WebSocket) ───────────────────────────────────────────

  const startDeviceLogin = useCallback(() => {
    if (loginState === "pending") return;

    outputRef.current = "";
    setLoginOutput("");
    setLoginUrls([]);
    setDeviceCode(null);
    setLoginState("pending");
    isLoginActiveRef.current = true;

    const socket = io(`${SERVER_URL}${CODEX_WS_NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("auth:login:start"));

    socket.on("auth:output", ({ text }: { text: string }) => {
      outputRef.current += text;
      setLoginOutput(outputRef.current);
      setLoginUrls(extractUrls(outputRef.current));
      const code = extractDeviceCode(outputRef.current);
      if (code) setDeviceCode(code);
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

  const cancelDeviceLogin = useCallback(() => {
    isLoginActiveRef.current = false;
    socketRef.current?.emit("auth:login:cancel");
    socketRef.current?.disconnect();
    socketRef.current = null;
    setLoginState("idle");
    setLoginOutput("");
    setLoginUrls([]);
    setDeviceCode(null);
    outputRef.current = "";
  }, []);

  // ── API key ───────────────────────────────────────────────────────────

  const saveApiKey = useCallback(async (apiKey: string) => {
    setConfigError("");
    setApiKeyLoginState("pending");
    try {
      await configureCodexAuth(apiKey);
      setApiKeyLoginState("done");
      setAuthState("authenticated");
    } catch {
      setConfigError("API 키 저장에 실패했습니다. 서버 연결을 확인하세요.");
      setApiKeyLoginState("error");
    }
  }, []);

  const resetApiKeyLogin = useCallback(() => {
    setApiKeyLoginState("idle");
    setConfigError("");
  }, []);

  return {
    authState,
    loginMethod,
    setLoginMethod,

    // device auth
    loginState,
    loginOutput,
    loginUrls,
    deviceCode,
    startDeviceLogin,
    cancelDeviceLogin,

    // api key
    apiKeyLoginState,
    configError,
    saveApiKey,
    resetApiKeyLogin,

    checkAuth,
  };
}
