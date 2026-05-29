"use client";

import { useCallback } from "react";

import { getClaudeStatus } from "@/features/auth/api/auth.api";
import type { ChatMessage, SessionState } from "./useClaudeSessions";

interface UseSessionCommandParams {
  selectedSession: SessionState | null;
  selectedSessionId: string | null;
  sendMessage: (sessionId: string, text: string) => void;
  injectClaudeMessage: (sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">) => void;
}

export function useSessionCommand({
  selectedSession,
  selectedSessionId,
  sendMessage,
  injectClaudeMessage,
}: UseSessionCommandParams) {
  return useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!selectedSessionId || !trimmed) return;

      if (trimmed === "/status" && selectedSession?.agentId === "claude") {
        injectClaudeMessage(selectedSessionId, { role: "user", content: "/status" });
        try {
          const data = await getClaudeStatus();
          const auth = data.auth;
          const authLines: string[] = [];

          if (auth.loggedIn) {
            authLines.push(`인증         ✅ 로그인됨 (${auth.authMethod})`);
            if (auth.email) authLines.push(`계정         ${auth.email}`);
            if (auth.orgName) authLines.push(`조직         ${auth.orgName}`);
            if (auth.subscriptionType) authLines.push(`구독         ${auth.subscriptionType}`);
          } else {
            authLines.push("인증         ❌ 로그아웃 상태");
          }

          const lines = [
            `Claude Code  ${data.version}`,
            `플랫폼       ${data.platform}`,
            ...authLines,
            `활성 세션    ${data.activeSessions}개`,
          ].join("\n");

          injectClaudeMessage(selectedSessionId, { role: "system", content: lines });
        } catch {
          injectClaudeMessage(selectedSessionId, {
            role: "system",
            content: "❌ 상태 조회 실패 — 서버 연결을 확인하세요.",
          });
        }
        return;
      }

      sendMessage(selectedSessionId, trimmed);
    },
    [injectClaudeMessage, selectedSession, selectedSessionId, sendMessage],
  );
}
