"use client";

import { useEffect, useRef } from "react";

import type { AgentStatus } from "../api/tasks.api";
import type { AgentLog } from "../hooks/useTaskExecution";
import { AgentRoleBadge } from "./AgentRoleSelect";
import type { AgentRole } from "../api/tasks.api";

// ─── 에이전트 상태 아이콘 ─────────────────────────────────────────────────────

function AgentStatusIcon({ status }: { status: AgentStatus }) {
  if (status === "running") {
    return <span className="h-3 w-3 animate-spin rounded-full border border-gray-500 border-t-orange-400" />;
  }
  if (status === "completed") return <span className="text-green-400">✓</span>;
  if (status === "error") return <span className="text-red-400">✕</span>;
  if (status === "stopped") return <span className="text-gray-500">■</span>;
  return <span className="h-2 w-2 rounded-full bg-gray-600" />;
}

// ─── 에이전트 상태 레이블 색상 ────────────────────────────────────────────────

const STATUS_TEXT: Record<AgentStatus, string> = {
  pending:   "text-gray-500",
  running:   "text-orange-400",
  completed: "text-green-400",
  error:     "text-red-400",
  stopped:   "text-gray-500",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  pending:   "대기",
  running:   "실행 중",
  completed: "완료",
  error:     "오류",
  stopped:   "중지",
};

// ─── 개별 에이전트 로그 패널 ──────────────────────────────────────────────────

interface AgentLogPanelProps {
  log: AgentLog;
  role: AgentRole;
  customRole: string | null;
}

function AgentLogPanel({ log, role, customRole }: AgentLogPanelProps) {
  const outputRef = useRef<HTMLPreElement>(null);

  // 새 출력이 올 때 자동 스크롤
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.output]);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gray-800 bg-gray-950">
      {/* 에이전트 헤더 */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <AgentStatusIcon status={log.status} />
          <AgentRoleBadge role={role} customRole={customRole} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${STATUS_TEXT[log.status]}`}>
            {STATUS_LABEL[log.status]}
          </span>
          {log.durationMs !== undefined && (
            <span className="text-xs text-gray-600">
              {(log.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {log.costUsd !== undefined && (
            <span className="text-xs text-gray-600">
              ${log.costUsd.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      {/* 출력 영역 */}
      {log.errorMessage ? (
        <p className="px-3 py-2 text-xs text-red-400">{log.errorMessage}</p>
      ) : log.output ? (
        <pre
          ref={outputRef}
          className="max-h-52 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-gray-300"
        >
          {log.output}
        </pre>
      ) : (
        <p className="px-3 py-2 text-xs text-gray-600">
          {log.status === "running" ? "출력을 기다리는 중…" : "출력 없음"}
        </p>
      )}
    </div>
  );
}

// ─── AgentOutputPanel ────────────────────────────────────────────────────────

interface Agent {
  id: number;
  role: AgentRole;
  customRole: string | null;
}

interface AgentOutputPanelProps {
  agents: Agent[];
  agentLogs: Record<number, AgentLog>;
  connected: boolean;
}

export function AgentOutputPanel({ agents, agentLogs, connected }: AgentOutputPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">에이전트 출력</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}
        />
        {!connected && (
          <span className="text-[10px] text-gray-600">연결 중…</span>
        )}
      </div>

      {agents.map((agent) => {
        const log = agentLogs[agent.id] ?? {
          agentId: agent.id,
          status: "running" as AgentStatus,
          output: "",
        };
        return (
          <AgentLogPanel
            key={agent.id}
            log={log}
            role={agent.role}
            customRole={agent.customRole}
          />
        );
      })}
    </div>
  );
}
