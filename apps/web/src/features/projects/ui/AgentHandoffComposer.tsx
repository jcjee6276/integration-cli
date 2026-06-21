"use client";

import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

import { ClaudeIcon, CodexIcon, GeminiIcon } from "@/features/chat/ui/AgentSelectModal";

import type { HandoffAgentId } from "../api/agentHandoff.api";

interface AgentHandoffComposerProps {
  fileName: string;
  line: number;
  endLine?: number;
  submittingAgent: HandoffAgentId | null;
  onSubmit: (agentId: HandoffAgentId, request: string) => Promise<void>;
}

const AGENTS: Array<{
  id: HandoffAgentId;
  label: string;
  icon: ReactNode;
  activeClass: string;
}> = [
  {
    id: "claude",
    label: "Claude",
    icon: <ClaudeIcon />,
    activeClass: "border-orange-500/35 bg-orange-500/[0.10]",
  },
  {
    id: "gemini",
    label: "Gemini",
    icon: <GeminiIcon />,
    activeClass: "border-blue-500/30 bg-blue-500/[0.08]",
  },
  {
    id: "codex",
    label: "Codex",
    icon: <CodexIcon />,
    activeClass: "border-gray-900/20 bg-gray-900/[0.06] dark:border-white/20 dark:bg-white/[0.07]",
  },
];

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M15.854.146a.5.5 0 01.11.54l-5.5 15a.5.5 0 01-.948-.02L7.42 9.58.334 6.484a.5.5 0 01.02-.948l15-5.5a.5.5 0 01.5.11zM2.002 6.03l5.93 2.59a.5.5 0 01.26.26l1.777 5.118L14.63 1.37 2.002 6.03z" />
    </svg>
  );
}

export function AgentHandoffComposer({
  fileName,
  line,
  endLine,
  submittingAgent,
  onSubmit,
}: AgentHandoffComposerProps) {
  const [agentId, setAgentId] = useState<HandoffAgentId>("codex");
  const [request, setRequest] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lineLabel = endLine && endLine !== line ? `${line}-${endLine}` : `${line}`;
  const submitting = Boolean(submittingAgent);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    try {
      event?.preventDefault();
      const trimmed = request.trim();
      if (!trimmed || submitting) return;
      await onSubmit(agentId, trimmed);
      setRequest("");
      inputRef.current?.focus();
    } catch {}
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    try {
      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
      event.preventDefault();
      void handleSubmit();
    } catch {}
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="pointer-events-auto absolute right-4 bottom-4 left-4 z-30 mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-gray-900/[0.09] bg-white/95 px-2.5 py-2 shadow-[0_18px_48px_-22px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/[0.10] dark:bg-[#111722]/95"
    >
      <div className="flex shrink-0 items-center gap-1">
        {AGENTS.map((agent) => {
          const selected = agent.id === agentId;
          const busy = submittingAgent === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              title={agent.label}
              disabled={submitting}
              onClick={() => setAgentId(agent.id)}
              className={[
                "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:cursor-default disabled:opacity-45 [&_svg]:h-4 [&_svg]:w-4",
                selected
                  ? agent.activeClass
                  : "border-transparent text-gray-900/35 hover:bg-gray-900/[0.05] hover:text-gray-900/65 dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/65",
              ].join(" ")}
            >
              {busy ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-900/15 border-t-emerald-500 dark:border-white/15 dark:border-t-emerald-300" />
              ) : (
                agent.icon
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden max-w-40 shrink-0 items-center gap-1.5 rounded-md bg-gray-900/[0.04] px-2 py-1 font-mono text-[10px] text-gray-900/42 md:flex dark:bg-white/[0.05] dark:text-white/42">
        <span className="truncate">{fileName}</span>
        <span className="text-emerald-600 dark:text-emerald-300">:{lineLabel}</span>
      </div>

      <textarea
        ref={inputRef}
        value={request}
        rows={1}
        disabled={submitting}
        onChange={(event) => setRequest(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="요청 입력..."
        className="max-h-24 min-h-8 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-gray-900/78 outline-none placeholder:text-gray-900/25 disabled:opacity-50 dark:text-white/78 dark:placeholder:text-white/25"
      />

      <button
        type="submit"
        title="전달"
        disabled={submitting || !request.trim()}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-default disabled:bg-gray-900/10 disabled:text-gray-900/25 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:hover:text-gray-950 dark:disabled:bg-white/10 dark:disabled:text-white/25"
      >
        <SendIcon />
      </button>
    </form>
  );
}
