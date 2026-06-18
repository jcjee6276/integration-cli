"use client";

import { useEffect, useRef, useState } from "react";

import type { AgentId } from "./AgentSelectModal";
import {
  AGENT_MODEL_OPTIONS,
  AGENT_REASONING_OPTIONS,
  getAgentModelSummary,
  type AgentModelSettings,
  type ReasoningLevel,
} from "../lib/agentModelOptions";

interface AgentModelPickerProps {
  agentId: AgentId;
  value?: AgentModelSettings;
  onChange: (agentId: AgentId, settings: AgentModelSettings) => void;
}

function ChipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M5.25 1A1.75 1.75 0 003.5 2.75v.75h-.75A1.75 1.75 0 001 5.25v5.5c0 .966.784 1.75 1.75 1.75h.75v.75c0 .966.784 1.75 1.75 1.75h5.5a1.75 1.75 0 001.75-1.75v-.75h.75A1.75 1.75 0 0015 10.75v-5.5a1.75 1.75 0 00-1.75-1.75h-.75v-.75A1.75 1.75 0 0010.75 1h-5.5zm0 1.5h5.5a.25.25 0 01.25.25v10.5a.25.25 0 01-.25.25h-5.5a.25.25 0 01-.25-.25V2.75a.25.25 0 01.25-.25zm-2.5 2.5h.75v6h-.75a.25.25 0 01-.25-.25v-5.5A.25.25 0 012.75 5zm9.75 0h.75a.25.25 0 01.25.25v5.5a.25.25 0 01-.25.25h-.75V5z" />
    </svg>
  );
}

function isSupportedAgent(agentId: AgentId) {
  return agentId === "claude" || agentId === "codex";
}

export function AgentModelPicker({ agentId, value, onChange }: AgentModelPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modelOptions = AGENT_MODEL_OPTIONS[agentId] ?? [];
  const reasoningOptions = AGENT_REASONING_OPTIONS[agentId] ?? [];
  const selectedModel = value?.model ?? "default";
  const selectedReasoning = value?.reasoning ?? "default";
  const disabled = !isSupportedAgent(agentId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const changeModel = (model: string) => {
    onChange(agentId, { ...(value ?? {}), model });
  };

  const changeReasoning = (reasoning: ReasoningLevel) => {
    onChange(agentId, { ...(value ?? {}), reasoning });
  };

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center justify-end">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        title="모델 및 추론 설정"
        className="flex min-w-0 max-w-[260px] cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-900/45 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/75 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/75"
      >
        <ChipIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{disabled ? "모델 기본값" : getAgentModelSummary(agentId, value)}</span>
      </button>

      {open && !disabled && (
        <div className="absolute bottom-full right-0 z-50 mb-1 w-80 rounded-xl border border-gray-900/[0.1] bg-white shadow-lg dark:border-white/[0.1] dark:bg-gray-900">
          <div className="border-b border-gray-900/[0.07] px-3 py-2 dark:border-white/[0.07]">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-900/30 dark:text-white/30">
              model
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-900/55 dark:text-white/55">
              {getAgentModelSummary(agentId, value)}
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {modelOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => changeModel(option.value)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-900/[0.04] dark:hover:bg-white/[0.05] ${
                  selectedModel === option.value ? "text-orange-600 dark:text-orange-400" : "text-gray-900/75 dark:text-white/75"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block truncate text-[11px] text-gray-900/35 dark:text-white/35">
                    {option.description}
                  </span>
                </span>
                {selectedModel === option.value && (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-6.25 6.25a.75.75 0 01-1.06 0L3.22 8.28a.75.75 0 111.06-1.06L7 9.94l5.72-5.72a.75.75 0 011.06 0z" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-900/[0.07] px-3 py-2 dark:border-white/[0.07]">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-900/30 dark:text-white/30">
              reasoning
            </p>
            <div className="grid grid-cols-3 gap-1">
              {reasoningOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeReasoning(option.value)}
                  className={`cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    selectedReasoning === option.value
                      ? "bg-orange-500 text-white"
                      : "bg-gray-900/[0.04] text-gray-900/45 hover:bg-gray-900/[0.07] hover:text-gray-900/75 dark:bg-white/[0.05] dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white/75"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
