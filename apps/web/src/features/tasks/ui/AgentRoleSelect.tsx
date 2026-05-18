"use client";

import type { AgentRole } from "../api/tasks.api";
import type { AgentDraft } from "../hooks/useTaskCreate";

const ROLES: { value: AgentRole; label: string; color: string }[] = [
  { value: "frontend", label: "Frontend", color: "bg-blue-900/40 border-blue-700 text-blue-300" },
  { value: "backend",  label: "Backend",  color: "bg-green-900/40 border-green-700 text-green-300" },
  { value: "doc",      label: "Doc",      color: "bg-purple-900/40 border-purple-700 text-purple-300" },
  { value: "operation",label: "Operation",color: "bg-yellow-900/40 border-yellow-700 text-yellow-300" },
  { value: "other",    label: "Other",    color: "bg-gray-800 border-gray-600 text-gray-300" },
];

interface AgentRowProps {
  agent: AgentDraft;
  onChange: (patch: Partial<Omit<AgentDraft, "id">>) => void;
  onRemove: () => void;
}

export function AgentRow({ agent, onChange, onRemove }: AgentRowProps) {
  const selected = ROLES.find((r) => r.value === agent.role) ?? ROLES[0];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-700/60 bg-gray-900/50 p-3">
      {/* 역할 뱃지 선택 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange({ role: r.value })}
              className={[
                "rounded-full border px-3 py-0.5 text-xs font-medium transition-all",
                agent.role === r.value
                  ? r.color
                  : "border-gray-700 bg-transparent text-gray-500 hover:border-gray-500 hover:text-gray-400",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto shrink-0 text-gray-600 transition-colors hover:text-red-400"
          aria-label="에이전트 삭제"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      {/* other 선택 시 커스텀 입력 */}
      {agent.role === "other" && (
        <input
          type="text"
          value={agent.customRole}
          onChange={(e) => onChange({ customRole: e.target.value })}
          placeholder="역할을 직접 입력하세요"
          className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-gray-500"
        />
      )}

      {/* 역할 설명 (frontend 전용 — 추후 다른 role 확장 가능) */}
      {agent.role === "frontend" && (
        <p className="text-[10px] text-blue-400/60">
          UI 구현 · 컴포넌트 개발 · 스타일링
        </p>
      )}
    </div>
  );
}

// 선택된 role의 뱃지만 표시 (읽기 전용)
export function AgentRoleBadge({ role, customRole }: { role: AgentRole; customRole?: string | null }) {
  const found = ROLES.find((r) => r.value === role);
  const label = role === "other" ? (customRole ?? "Other") : (found?.label ?? role);
  const color = found?.color ?? "bg-gray-800 border-gray-600 text-gray-300";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
