"use client";

import { useCallback, useEffect, useState } from "react";

import type { AgentId } from "../ui/AgentSelectModal";
import type { AgentModelSettings, AgentModelSettingsByAgent } from "../lib/agentModelOptions";

const STORAGE_KEY = "ji.agentModelSettings";

const DEFAULT_SETTINGS: AgentModelSettingsByAgent = {
  claude: { model: "default", reasoning: "default" },
  codex: { model: "default", reasoning: "default" },
};

function readStoredSettings(): AgentModelSettingsByAgent {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as AgentModelSettingsByAgent;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useAgentModelSettings() {
  const [settingsByAgent, setSettingsByAgent] =
    useState<AgentModelSettingsByAgent>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettingsByAgent(readStoredSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsByAgent));
    } catch {}
  }, [hydrated, settingsByAgent]);

  const updateSettings = useCallback((agentId: AgentId, settings: AgentModelSettings) => {
    setSettingsByAgent((prev) => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] ?? {}),
        ...settings,
      },
    }));
  }, []);

  return { settingsByAgent, updateSettings };
}
