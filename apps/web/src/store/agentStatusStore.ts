import { create } from "zustand";

import { getAuthStatus, getCodexAuthStatus, getGeminiAuthStatus } from "@/features/auth/api/auth.api";
import type { AgentId } from "@/features/chat/ui/AgentSelectModal";
import type { ConnectionStatus } from "@/features/chat/hooks/useUnifiedSessions";

interface AgentStatusState {
  statusByAgent: Record<AgentId, ConnectionStatus>;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useAgentStatusStore = create<AgentStatusState>((set) => ({
  statusByAgent: {
    claude: "disconnected",
    gemini: "disconnected",
    codex: "disconnected",
    opencode: "disconnected",
  },
  loading: false,
  refresh: async () => {
    set({ loading: true });
    const [claude, gemini, codex] = await Promise.allSettled([
      getAuthStatus(),
      getGeminiAuthStatus(),
      getCodexAuthStatus(),
    ]);
    set({
      loading: false,
      statusByAgent: {
        claude: claude.status === "fulfilled" && claude.value.loggedIn ? "connected" : "disconnected",
        gemini: gemini.status === "fulfilled" && gemini.value.loggedIn && gemini.value.installed ? "connected" : "disconnected",
        codex: codex.status === "fulfilled" && codex.value.loggedIn && codex.value.installed ? "connected" : "disconnected",
        opencode: "disconnected",
      },
    });
  },
}));
