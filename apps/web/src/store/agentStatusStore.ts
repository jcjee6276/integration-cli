import { create } from "zustand";

import {
  getAuthStatus,
  getCodexAuthStatus,
  getGeminiAuthStatus,
} from "@/features/auth/api/auth.api";
import type { ConnectionStatus } from "@/features/chat/hooks/useUnifiedSessions";
import type { AgentId } from "@/features/chat/ui/AgentSelectModal";

interface AgentStatusState {
  statusByAgent: Record<AgentId, ConnectionStatus>;
  loading: boolean;
  refresh: () => Promise<void>;
}

const INITIAL_STATUS_BY_AGENT: Record<AgentId, ConnectionStatus> = {
  claude: "disconnected",
  gemini: "disconnected",
  codex: "disconnected",
  opencode: "disconnected",
};

function isSameStatusByAgent(
  current: Record<AgentId, ConnectionStatus>,
  next: Record<AgentId, ConnectionStatus>,
) {
  return (
    current.claude === next.claude &&
    current.gemini === next.gemini &&
    current.codex === next.codex &&
    current.opencode === next.opencode
  );
}

export const useAgentStatusStore = create<AgentStatusState>((set) => ({
  statusByAgent: INITIAL_STATUS_BY_AGENT,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const [claude, gemini, codex] = await Promise.allSettled([
        getAuthStatus(),
        getGeminiAuthStatus(),
        getCodexAuthStatus(),
      ]);
      const nextStatusByAgent: Record<AgentId, ConnectionStatus> = {
        claude:
          claude.status === "fulfilled" && claude.value.loggedIn ? "connected" : "disconnected",
        gemini:
          gemini.status === "fulfilled" && gemini.value.loggedIn && gemini.value.installed
            ? "connected"
            : "disconnected",
        codex:
          codex.status === "fulfilled" && codex.value.loggedIn && codex.value.installed
            ? "connected"
            : "disconnected",
        opencode: "disconnected",
      };
      set((state) => ({
        loading: false,
        statusByAgent: isSameStatusByAgent(state.statusByAgent, nextStatusByAgent)
          ? state.statusByAgent
          : nextStatusByAgent,
      }));
    } catch (error) {
      console.error("Failed to refresh agent status", error);
      set({ loading: false });
    }
  },
}));
