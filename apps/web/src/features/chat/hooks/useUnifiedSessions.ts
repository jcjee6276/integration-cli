"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentModelSettings, AgentModelSettingsByAgent } from "../lib/agentModelOptions";
import type { AgentId } from "../ui/AgentSelectModal";

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
  const {
    connectionStatus: claudeConnectionStatus,
    sessions: claudeSessions,
    error: claudeError,
    createSession: createClaudeSession,
    selectSession: selectClaudeSession,
    sendMessage: sendClaudeMessage,
    terminateSession: terminateClaudeSession,
    renameSession: renameClaudeSession,
    deleteSessionFromDB: deleteClaudeSessionFromDB,
    injectMessage: injectClaudeSessionMessage,
  } = useClaudeSessions();
  const {
    connectionStatus: geminiConnectionStatus,
    sessions: geminiSessions,
    error: geminiError,
    createSession: createGeminiSession,
    selectSession: selectGeminiSession,
    sendMessage: sendGeminiMessage,
    terminateSession: terminateGeminiSession,
    renameSession: renameGeminiSession,
    deleteSessionFromDB: deleteGeminiSessionFromDB,
  } = useGeminiSessions();
  const {
    connectionStatus: codexConnectionStatus,
    sessions: codexSessions,
    error: codexError,
    createSession: createCodexSession,
    selectSession: selectCodexSession,
    sendMessage: sendCodexMessage,
    terminateSession: terminateCodexSession,
    renameSession: renameCodexSession,
    deleteSessionFromDB: deleteCodexSessionFromDB,
  } = useCodexSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessions = useMemo(
    () =>
      [...claudeSessions, ...geminiSessions, ...codexSessions].sort(
        (a, b) => new Date(b.info.createdAt).getTime() - new Date(a.info.createdAt).getTime(),
      ),
    [claudeSessions, geminiSessions, codexSessions],
  );
  const sessionsRef = useRef<UnifiedSessionState[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const connectionStatusByAgent = useMemo<Record<AgentId, ConnectionStatus>>(
    () => ({
      claude: claudeConnectionStatus,
      gemini: geminiConnectionStatus,
      codex: codexConnectionStatus,
      opencode: "disconnected",
    }),
    [claudeConnectionStatus, geminiConnectionStatus, codexConnectionStatus],
  );

  const overallConnectionStatus = useMemo(
    () =>
      getOverallConnectionStatus([
        claudeConnectionStatus,
        geminiConnectionStatus,
        codexConnectionStatus,
      ]),
    [claudeConnectionStatus, geminiConnectionStatus, codexConnectionStatus],
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.info.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const selectedConnectionStatus = selectedSession
    ? connectionStatusByAgent[selectedSession.agentId]
    : overallConnectionStatus;

  const error = claudeError ?? geminiError ?? codexError;

  const findSession = useCallback(
    (sessionId: string) => sessionsRef.current.find((s) => s.info.id === sessionId) ?? null,
    [],
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId);
      selectClaudeSession(sessionId);
      selectGeminiSession(sessionId);
      selectCodexSession(sessionId);
    },
    [selectClaudeSession, selectGeminiSession, selectCodexSession],
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
        sessionId = await createGeminiSession(workingDirectory);
      } else if (agentId === "codex") {
        sessionId = await createCodexSession(workingDirectory, modelSettings);
      } else if (agentId === "claude") {
        sessionId = await createClaudeSession(agentId, workingDirectory, modelSettings);
      }

      if (sessionId) setSelectedSessionId(sessionId);
      return sessionId;
    },
    [connectionStatusByAgent, createClaudeSession, createGeminiSession, createCodexSession],
  );

  const sendMessage = useCallback(
    (sessionId: string, text: string, modelSettingsByAgent?: AgentModelSettingsByAgent) => {
      const session = findSession(sessionId);
      if (!session) return;
      const modelSettings = modelSettingsByAgent?.[session.agentId];
      if (session.agentId === "gemini") sendGeminiMessage(sessionId, text);
      else if (session.agentId === "codex") sendCodexMessage(sessionId, text, modelSettings);
      else sendClaudeMessage(sessionId, text, modelSettings);
    },
    [findSession, sendClaudeMessage, sendGeminiMessage, sendCodexMessage],
  );

  const terminateSession = useCallback(
    async (sessionId: string) => {
      const session = findSession(sessionId);
      if (!session) return;
      if (session.agentId === "gemini") await terminateGeminiSession(sessionId);
      else if (session.agentId === "codex") await terminateCodexSession(sessionId);
      else await terminateClaudeSession(sessionId);
      setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
    },
    [findSession, terminateClaudeSession, terminateGeminiSession, terminateCodexSession],
  );

  const renameSession = useCallback(
    (sessionId: string, newTitle: string) => {
      const session = findSession(sessionId);
      if (!session) return;
      if (session.agentId === "gemini") renameGeminiSession(sessionId, newTitle);
      else if (session.agentId === "codex") renameCodexSession(sessionId, newTitle);
      else renameClaudeSession(sessionId, newTitle);
    },
    [findSession, renameClaudeSession, renameGeminiSession, renameCodexSession],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const session = findSession(sessionId);
      if (!session) return;
      if (session.agentId === "gemini") deleteGeminiSessionFromDB(sessionId);
      else if (session.agentId === "codex") deleteCodexSessionFromDB(sessionId);
      else deleteClaudeSessionFromDB(sessionId);
      setSelectedSessionId((prev) => (prev === sessionId ? null : prev));
    },
    [findSession, deleteClaudeSessionFromDB, deleteGeminiSessionFromDB, deleteCodexSessionFromDB],
  );

  const injectClaudeMessage = useCallback(
    (sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">) => {
      injectClaudeSessionMessage(sessionId, message);
    },
    [injectClaudeSessionMessage],
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
    deleteSession,
    injectClaudeMessage,
  };
}
