"use client";

import type { TaskAgent } from "../api/tasks.api";
import type { TaskRun } from "../api/tasks.api";
import { useTaskRuns } from "../hooks/useTaskRuns";
import { AgentRoleBadge } from "./AgentRoleSelect";

// ─── 실행 상태 설정 ───────────────────────────────────────────────────────────

const RUN_STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  running:   { label: "실행 중",  dot: "bg-emerald-500 animate-pulse", text: "text-emerald-600 dark:text-emerald-400" },
  completed: { label: "완료",    dot: "bg-blue-500",                   text: "text-blue-600 dark:text-blue-400" },
  error:     { label: "오류",    dot: "bg-red-500",                    text: "text-red-600 dark:text-red-400" },
  stopped:   { label: "중지됨",  dot: "bg-gray-400",                   text: "text-gray-500 dark:text-gray-400" },
  pending:   { label: "대기",    dot: "bg-gray-300",                   text: "text-gray-400" },
};

function RunStatusBadge({ status }: { status: string }) {
  const cfg = RUN_STATUS_CONFIG[status] ?? RUN_STATUS_CONFIG.pending;
  return (
    <span className={`flex items-center gap-1 text-xs ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── 단일 실행 행 ─────────────────────────────────────────────────────────────

interface RunRowProps {
  run: TaskRun;
  agents: TaskAgent[];
  isLatest: boolean;
  canRerunAgent?: boolean;
  rerunDisabled?: boolean;
  onRerunAgent?: (agentId: number) => void;
}

function RunRow({ run, agents, isLatest, canRerunAgent, rerunDisabled, onRerunAgent }: RunRowProps) {
  const duration = run.completedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;

  const totalCost = run.agentRuns.reduce((s, ar) => s + (ar.costUsd ?? 0), 0);

  return (
    <div className={[
      "flex flex-col gap-2 rounded-xl border p-3 transition-colors",
      isLatest
        ? "border-blue-500/20 bg-blue-500/[0.04] dark:border-blue-500/20"
        : "border-gray-900/[0.06] bg-gray-900/[0.01] dark:border-white/[0.06] dark:bg-white/[0.01]",
    ].join(" ")}>
      {/* 버전 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={[
            "flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isLatest
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-gray-900/[0.06] text-gray-900/50 dark:bg-white/[0.06] dark:text-white/50",
          ].join(" ")}>
            v{run.version}
          </span>
          {isLatest && (
            <span className="text-[10px] text-blue-500/70 dark:text-blue-400/70">최신</span>
          )}
          <RunStatusBadge status={run.status} />
        </div>

        <div className="flex items-center gap-2 text-[10px] text-gray-900/25 dark:text-white/25">
          {duration != null && <span>{duration}s</span>}
          {totalCost > 0 && <span>${totalCost.toFixed(4)}</span>}
          <span>
            {new Date(run.startedAt).toLocaleString("ko-KR", {
              month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* 보완 사항 */}
      {run.supplementNote && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-2.5 py-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
          <span className="mr-1 font-medium">보완 사항:</span>
          {run.supplementNote}
        </p>
      )}

      {/* 에이전트별 실행 결과 */}
      {run.agentRuns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {run.agentRuns.map((ar) => {
            const agent = agents.find((a) => a.id === ar.agentId);
            const statusCfg = RUN_STATUS_CONFIG[ar.status] ?? RUN_STATUS_CONFIG.pending;
            return (
              <div
                key={ar.id}
                className="flex items-center gap-1.5 rounded-lg border border-gray-900/[0.06] bg-gray-900/[0.02] px-2 py-1 dark:border-white/[0.06] dark:bg-white/[0.02]"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusCfg.dot}`} />
                {agent ? (
                  <AgentRoleBadge role={agent.role} customRole={agent.customRole} />
                ) : (
                  <span className="text-[10px] text-gray-900/40 dark:text-white/40">Agent {ar.agentId}</span>
                )}
                {ar.durationMs != null && ar.durationMs > 0 && (
                  <span className="text-[10px] text-gray-900/20 dark:text-white/20">
                    {(ar.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {canRerunAgent && (
                  <button
                    type="button"
                    onClick={() => onRerunAgent?.(ar.agentId)}
                    disabled={rerunDisabled}
                    className="ml-1 cursor-pointer rounded-md border border-blue-500/25 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:border-blue-400/50 hover:bg-blue-500/[0.08] disabled:cursor-default disabled:opacity-40 dark:text-blue-400"
                    title="이 에이전트만 재실행"
                  >
                    재실행
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── RunHistoryPanel ──────────────────────────────────────────────────────────

interface Props {
  taskId: string;
  agents: TaskAgent[];
  canRerunAgent?: boolean;
  rerunDisabled?: boolean;
  onRerunAgent?: (agentId: number) => void;
}

export function RunHistoryPanel({ taskId, agents, canRerunAgent, rerunDisabled, onRerunAgent }: Props) {
  const { runs, loading, error } = useTaskRuns(taskId);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 py-1">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-gray-900/[0.05] bg-gray-900/[0.02] dark:border-white/[0.05] dark:bg-white/[0.02]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gray-900/15 dark:text-white/15">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-gray-900/30 dark:text-white/30">실행 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {runs.map((run, idx) => (
        <RunRow
          key={run.id}
          run={run}
          agents={agents}
          isLatest={idx === 0}
          canRerunAgent={canRerunAgent}
          rerunDisabled={rerunDisabled}
          onRerunAgent={onRerunAgent}
        />
      ))}
    </div>
  );
}
