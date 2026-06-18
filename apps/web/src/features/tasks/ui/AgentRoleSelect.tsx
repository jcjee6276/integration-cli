"use client";

import { AGENT_META } from "@/features/chat/ui/AgentSelectModal";
import type { AgentRole } from "../api/tasks.api";
import type { AgentDraft } from "../hooks/useTaskCreate";

const ROLES: { value: AgentRole; label: string; active: string; badge: string }[] = [
  { value: "frontend",  label: "Frontend",  active: "border-blue-500/50 bg-blue-500/[0.12] text-blue-700 dark:text-blue-300",   badge: "border-blue-500/40 bg-blue-500/[0.08] text-blue-700 dark:text-blue-300" },
  { value: "backend",   label: "Backend",   active: "border-emerald-500/50 bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300", badge: "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300" },
  { value: "doc",       label: "Doc",       active: "border-purple-500/50 bg-purple-500/[0.12] text-purple-700 dark:text-purple-300", badge: "border-purple-500/40 bg-purple-500/[0.08] text-purple-700 dark:text-purple-300" },
  { value: "operation", label: "Operation", active: "border-amber-500/50 bg-amber-500/[0.12] text-amber-700 dark:text-amber-300",  badge: "border-amber-500/40 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300" },
  { value: "other",     label: "Other",     active: "border-gray-900/[0.2] bg-gray-900/[0.07] text-gray-700 dark:border-white/[0.2] dark:bg-white/[0.07] dark:text-white/70", badge: "border-gray-900/[0.12] bg-gray-900/[0.05] text-gray-600 dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-white/50" },
];

interface AgentRowProps {
  agent: AgentDraft;
  onChange: (patch: Partial<Omit<AgentDraft, "id">>) => void;
  onRemove: () => void;
}

export function AgentRow({ agent, onChange, onRemove }: AgentRowProps) {
  const agentMeta = AGENT_META[agent.agentType];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-900/[0.07] bg-gray-900/[0.02] p-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
      {/* AI 에이전트 + 삭제 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${agentMeta.dotColor}`} />
          <span className="text-xs font-semibold text-gray-900/60 dark:text-white/60">
            {agentMeta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 cursor-pointer text-gray-900/20 transition-colors hover:text-red-500 dark:text-white/20 dark:hover:text-red-400"
          aria-label="에이전트 삭제"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      {/* 역할 뱃지 선택 */}
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange({ role: r.value })}
            className={[
              "cursor-pointer rounded-full border px-3 py-0.5 text-xs font-medium transition-all",
              agent.role === r.value
                ? r.active
                : "border-gray-900/[0.07] text-gray-900/25 hover:border-gray-900/[0.13] hover:text-gray-900/50 dark:border-white/[0.07] dark:text-white/25 dark:hover:border-white/[0.13] dark:hover:text-white/50",
            ].join(" ")}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* other 선택 시 커스텀 입력 */}
      {agent.role === "other" && (
        <input
          type="text"
          value={agent.customRole}
          onChange={(e) => onChange({ customRole: e.target.value })}
          placeholder="역할을 직접 입력하세요"
          className="w-full rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.03] px-3 py-1.5 text-xs text-gray-900/70 placeholder-gray-900/20 outline-none transition-colors focus:border-gray-900/[0.15] dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-white/70 dark:placeholder-white/20 dark:focus:border-white/[0.15]"
        />
      )}

      {/* 역할 힌트 */}
      {agent.role === "frontend" && (
        <p className="text-[10px] text-blue-600/60 dark:text-blue-400/50">UI 구현 · 컴포넌트 개발 · 스타일링</p>
      )}
      {agent.role === "backend" && (
        <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50">API 개발 · DB 설계 · 서버 로직</p>
      )}
    </div>
  );
}

// 선택된 role의 뱃지만 표시 (읽기 전용)
export function AgentRoleBadge({ role, customRole }: { role: AgentRole; customRole?: string | null }) {
  const found = ROLES.find((r) => r.value === role);
  const label = role === "other" ? (customRole ?? "Other") : (found?.label ?? role);
  const cls   = found?.badge ?? "border-gray-900/[0.12] bg-gray-900/[0.05] text-gray-600 dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-white/50";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
