"use client";

import { useCallback, useEffect, useState } from "react";

import { configureCodexAuth, getCodexAuthStatus } from "../api/auth.api";

export type CodexAuthState = "checking" | "authenticated" | "unauthenticated" | "not-installed";
export type CodexLoginState = "idle" | "pending" | "done" | "error";

export function useCodexAuth() {
  const [authState, setAuthState] = useState<CodexAuthState>("checking");
  const [loginState, setLoginState] = useState<CodexLoginState>("idle");
  const [configError, setConfigError] = useState("");

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

  const saveApiKey = useCallback(async (apiKey: string) => {
    setConfigError("");
    setLoginState("pending");
    try {
      await configureCodexAuth(apiKey);
      setLoginState("done");
      setAuthState("authenticated");
    } catch {
      setConfigError("API 키 저장에 실패했습니다. 서버 연결을 확인하세요.");
      setLoginState("error");
    }
  }, []);

  const resetLogin = useCallback(() => {
    setLoginState("idle");
    setConfigError("");
  }, []);

  return {
    authState,
    loginState,
    configError,
    saveApiKey,
    resetLogin,
    checkAuth,
  };
}
