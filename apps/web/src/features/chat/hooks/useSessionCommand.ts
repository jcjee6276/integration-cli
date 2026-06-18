"use client";

import { useCallback } from "react";

import type { AgentModelSettingsByAgent } from "../lib/agentModelOptions";
import type { ChatMessage, SessionState } from "./useClaudeSessions";

interface UseSessionCommandParams {
  selectedSession: SessionState | null;
  selectedSessionId: string | null;
  sendMessage: (sessionId: string, text: string, modelSettingsByAgent?: AgentModelSettingsByAgent) => void;
  modelSettingsByAgent?: AgentModelSettingsByAgent;
  injectClaudeMessage: (sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">) => void;
  onShowStatus?: () => void;
}

export function useSessionCommand({
  selectedSession,
  selectedSessionId,
  sendMessage,
  modelSettingsByAgent,
  injectClaudeMessage,
  onShowStatus,
}: UseSessionCommandParams) {
  return useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!selectedSessionId || !trimmed) return;

      if (trimmed === "/status") {
        onShowStatus?.();
        return;
      }

      sendMessage(selectedSessionId, trimmed, modelSettingsByAgent);
    },
    [modelSettingsByAgent, onShowStatus, selectedSessionId, sendMessage],
  );
}
