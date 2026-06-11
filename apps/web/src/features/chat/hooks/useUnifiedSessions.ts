"use client";

import { useCallback, useMemo, useState } from "react";

import type { AgentId } from "../ui/AgentSelectModal";
import type { AgentModelSettings, AgentModelSettingsByAgent } from "../lib/agentModelOptions";
import { useClaudeSessions } from "./useClaudeSessions";
import type { ChatMessage, SessionState } from "./useClaudeSessions";
import { useCodexSessions } from "./useCodexSessions";
import { useGeminiSessions } from "./useGeminiSessions";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type UnifiedSessionState = SessionState;

export function getOverallConnectionStatus(statuses: ConnectionStatus[]): ConnectionStatus {
  if (statuses.includes("connected")) return "connected";
  if (statuses.includes("connecting")) return "connecting";
  return "disconnected";
}

export function useUnifiedSessions() {
  const claude = useClaudeSessions();
  const gemini = useGeminiSessions();
  const codex = useCodexSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessions = useMemo(
    () =>
      [...claude.sessions, ...gemini.sessions, ...codex.sessions].sort(
        (a, b) => new Date(b.info.createdAt).getTime() - new Date(a.info.createdAt).getTime(),
      ),
    [claude.sessions, gemini.sessions, codex.sessions],
  );

  const connectionStatusByAgent = useMemo<Record<AgentId, ConnectionStatus>>(
    () => ({
      claude: claude.connectionStatus,
      gemini: gemini.connectionStatus,
      codex: codex.connectionStatus,
      opencode: "disconnected",
    }),
    [claude.connectionStatus, gemini.connectionStatus, codex.connectionStatus],
  );

  const overallConnectionStatus = useMemo(
    () => getOverallConnectionStatus([claude.connectionStatus, gemini.connectionStatus, codex.connectionStatus]),
    [claude.connectionStatus, gemini.connectionStatus, codex.connectionStatus],
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.info.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const selectedConnectionStatus = selectedSession
    ? connectionStatusByAgent[selectedSession.agentId]
    : overallConnectionStatus;

  const error = claude.error ?? gemini.error ?? codex.error;

  const findSession = useCallback(
    (sessionId: string) => sessions.find((s) => s.info.id === sessionId) ?? null,
    [sessions],
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId);
      claude.selectSession(sessionId);
      gemini.selectSession(sessionId);
      codex.selectSession(sessionId);
    },
    [claude, gemini, codex],
  );

  const createSession = useCallback(
    async (
      agentId: AgentId,
      workingDirectory?: string,
      modelSettings?: AgentModelSettings,
    ): Promise<string | null> => {
      if (connectionStatusByAgent[agentId] !== "connected") return null;

      let sessionId: string | null = null;
      if (agentId === "gemini") {
        sessionId = await gemini.createSession(workingDirectory);
      } else if (agentId === "codex") {
        sessionId = await codex.createSession(workingDirectory, modelSettings);
      } else if (agentId === "claude") {
        sessionId = await claude.createSession(agentId, workingDirectory, modelSettings);
      }

      if (sessionId) setSelectedSessionId(sessionId);
      return sessionId;
    },
    [connectionStatusByAgent, claude, gemini, codex],
  );

  const sendMessage = useCallback(
    (sessionId: string, text: string, modelSettingsByAgent?: AgentModelSettingsByAgent) => {
      const session = findSession(sessionId);
      if (!session) return;
      const modelSettings = modelSettingsByAgent?.[session.agentId];
      if (session.agentId === "gemini") gemini.sendMessage(sessionId, text);
      else if (session.agentId === "codex") codex.sendMessage(sessionId, text, modelSettings);
      else claude.sendMessage(sessionId, text, modelSettings);
    },
    [findSession, claude, gemini, codex],
  );

  const terminateSession = useCallback(
    async (sessionId: string) => {
      const session = findSession(sessionId);
      if (!session) return;
      if (session.agentId === "gemini") await gemini.terminateSession(sessionId);
      else if (session.agentId === "codex") await codex.terminateSession(sessionId);
      else await claude.terminateSession(sessionId);
      setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
    },
    [findSession, claude, gemini, codex],
  );

  const renameSession = useCallback(
    (sessionId: string, newTitle: string) => {
      const session = findSession(sessionId);
      if (!session) return;
      if (session.agentId === "gemini") gemini.renameSession(sessionId, newTitle);
      else if (session.agentId === "codex") codex.renameSession(sessionId, newTitle);
      else claude.renameSession(sessionId, newTitle);
    },
    [findSession, claude, gemini, codex],
  );

  const injectClaudeMessage = useCallback(
    (sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">) => {
      claude.injectMessage(sessionId, message);
    },
    [claude],
  );

  return {
    sessions,
    selectedSession,
    selectedSessionId,
    selectedConnectionStatus,
    connectionStatusByAgent,
    overallConnectionStatus,
    error,
    createSession,
    selectSession,
    sendMessage,
    terminateSession,
    renameSession,
    injectClaudeMessage,
  };
}
