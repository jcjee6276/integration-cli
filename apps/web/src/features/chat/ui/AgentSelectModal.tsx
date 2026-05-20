"use client";

import { Modal } from "@/components/ui/Modal";

export type AgentId = "claude" | "gemini" | "codex" | "opencode";

interface AgentDef {
  id: AgentId;
  name: string;
  vendor: string;
  description: string;
  available: boolean;
  iconBg: string;
  hoverBorder: string;
  hoverBg: string;
  icon: React.ReactNode;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

export const ClaudeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-[#D97757]">
    <path d="M13.827 3.816L20.05 20.2h-3.672l-1.234-3.365H8.856L7.622 20.2H3.95L10.173 3.816h3.654zm-1.827 4.91l-1.989 5.453h3.978l-1.989-5.453z" />
  </svg>
);

export const GeminiIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const CodexIcon = () => (
  // OpenAI logo — simplified
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-gray-900 dark:text-white">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9 6.065 6.065 0 0 0-10.75 2.918 5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.985 5.985 0 0 0 .511 4.91 6.046 6.046 0 0 0 6.515 2.9 5.985 5.985 0 0 0 4.514 2.012 6.046 6.046 0 0 0 5.772-4.206 5.985 5.985 0 0 0 3.998-2.9 6.046 6.046 0 0 0-.747-7.071zM13.26 21.4a4.476 4.476 0 0 1-2.876-1.041l.141-.08 4.779-2.758a.775.775 0 0 0 .393-.681v-6.737l2.02 1.169a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.493zM3.6 17.275a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.775.775 0 0 0 .781 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-2.675zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973v5.701a.77.77 0 0 0 .388.677l5.815 3.354-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.787A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.843-3.354 2.02-1.169a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.695zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.775.775 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
  </svg>
);

export const OpenCodeIcon = () => (
  // OpenCode — terminal bracket style
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-emerald-500">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
    <line x1="12" y1="4" x2="12" y2="20" strokeWidth="1.4" strokeDasharray="2 2" />
  </svg>
);

// ─── Agent Definitions ────────────────────────────────────────────────────────

const AGENTS: AgentDef[] = [
  {
    id: "claude",
    name: "Claude Code",
    vendor: "Anthropic",
    description: "코드 작성, 디버깅, 리팩터링을 위한 AI 어시스턴트",
    available: true,
    iconBg: "bg-orange-500/[0.10]",
    hoverBorder: "hover:border-orange-500/30",
    hoverBg: "hover:bg-orange-500/[0.04]",
    icon: <ClaudeIcon />,
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    vendor: "Google",
    description: "Google Gemini 기반 코딩 어시스턴트",
    available: true,
    iconBg: "bg-blue-500/[0.08]",
    hoverBorder: "hover:border-blue-500/20",
    hoverBg: "hover:bg-blue-500/[0.03]",
    icon: <GeminiIcon />,
  },
  {
    id: "codex",
    name: "Codex CLI",
    vendor: "OpenAI",
    description: "OpenAI Codex 기반 터미널 에이전트",
    available: false,
    iconBg: "bg-gray-900/[0.05] dark:bg-white/[0.06]",
    hoverBorder: "hover:border-gray-900/20 dark:hover:border-white/20",
    hoverBg: "hover:bg-gray-900/[0.03] dark:hover:bg-white/[0.03]",
    icon: <CodexIcon />,
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "OpenCode",
    description: "오픈소스 AI 코딩 에이전트",
    available: false,
    iconBg: "bg-emerald-500/[0.08]",
    hoverBorder: "hover:border-emerald-500/20",
    hoverBg: "hover:bg-emerald-500/[0.03]",
    icon: <OpenCodeIcon />,
  },
];

// ─── Agent Card ───────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentDef;
  onSelect: (id: AgentId) => void;
}

function AgentCard({ agent, onSelect }: AgentCardProps) {
  return (
    <button
      onClick={() => agent.available && onSelect(agent.id)}
      disabled={!agent.available}
      className={[
        "group relative flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200",
        "border-gray-900/[0.07] bg-gray-900/[0.02] dark:border-white/[0.07] dark:bg-white/[0.02]",
        agent.available
          ? `cursor-pointer ${agent.hoverBorder} ${agent.hoverBg}`
          : "cursor-not-allowed opacity-45",
      ].join(" ")}
    >
      {/* Icon */}
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-900/[0.06] dark:border-white/[0.06]",
          agent.iconBg,
        ].join(" ")}
      >
        {agent.icon}
      </span>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900/85 dark:text-white/85">
            {agent.name}
          </span>
          <span className="text-[10px] font-medium text-gray-900/25 dark:text-white/25">
            {agent.vendor}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-900/40 dark:text-white/40">{agent.description}</p>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        {agent.available ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            사용 가능
          </span>
        ) : (
          <span className="rounded-full border border-gray-900/[0.06] bg-gray-900/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-900/30 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/30">
            준비 중
          </span>
        )}
      </div>

      {/* Arrow */}
      {agent.available && (
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3.5 w-3.5 shrink-0 text-gray-900/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-900/50 dark:text-white/20 dark:group-hover:text-white/50"
        >
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface AgentSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (agentId: AgentId) => void;
}

export function AgentSelectModal({ open, onClose, onSelect }: AgentSelectModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="에이전트 선택" maxWidth="max-w-md" zIndex="z-[60]">
      <div className="flex flex-col gap-2.5">
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onSelect={(id) => { onSelect(id); onClose(); }}
          />
        ))}
      </div>
    </Modal>
  );
}

// ─── Agent meta (for external use) ───────────────────────────────────────────

export const AGENT_META: Record<AgentId, { label: string; dotColor: string }> = {
  claude:    { label: "Claude Code", dotColor: "bg-orange-400" },
  gemini:    { label: "Gemini CLI",  dotColor: "bg-blue-400" },
  codex:     { label: "Codex CLI",   dotColor: "bg-gray-400" },
  opencode:  { label: "OpenCode",    dotColor: "bg-emerald-400" },
};

export const AGENT_AVATAR: Record<AgentId, { bg: string; icon: React.ReactNode }> = {
  claude:   { bg: "bg-[#D97757]",                                            icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white"><path d="M13.827 3.816L20.05 20.2h-3.672l-1.234-3.365H8.856L7.622 20.2H3.95L10.173 3.816h3.654zm-1.827 4.91l-1.989 5.453h3.978l-1.989-5.453z" /></svg> },
  gemini:   { bg: "bg-white dark:bg-gray-800",                               icon: <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg> },
  codex:    { bg: "bg-gray-900 dark:bg-white",                               icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white dark:text-gray-900"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9 6.065 6.065 0 0 0-10.75 2.918 5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.985 5.985 0 0 0 .511 4.91 6.046 6.046 0 0 0 6.515 2.9 5.985 5.985 0 0 0 4.514 2.012 6.046 6.046 0 0 0 5.772-4.206 5.985 5.985 0 0 0 3.998-2.9 6.046 6.046 0 0 0-.747-7.071zM13.26 21.4a4.476 4.476 0 0 1-2.876-1.041l.141-.08 4.779-2.758a.775.775 0 0 0 .393-.681v-6.737l2.02 1.169a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.493zM3.6 17.275a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.775.775 0 0 0 .781 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-2.675zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973v5.701a.77.77 0 0 0 .388.677l5.815 3.354-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.787A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.843-3.354 2.02-1.169a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.695zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.775.775 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" /></svg> },
  opencode: { bg: "bg-emerald-600",                                          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="12" y1="4" x2="12" y2="20" strokeWidth="1.4" strokeDasharray="2 2" /></svg> },
};
