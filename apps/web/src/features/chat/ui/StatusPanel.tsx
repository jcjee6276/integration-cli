"use client";

import { useEffect, useState } from "react";

import { getClaudeStatus } from "@/features/auth/api/auth.api";
import type { ClaudeStatus } from "@/features/auth/api/auth.api";

interface Props {
  agentId: string;
  onClose: () => void;
}

export function StatusPanel({ agentId, onClose }: Props) {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getClaudeStatus()
      .then(setStatus)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-gray-900/[0.08] bg-white shadow-[0_8px_32px_-4px_rgba(0,0,0,0.10)] dark:border-white/[0.08] dark:bg-[#0e1117] dark:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-gray-900/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">Status</span>
          <span className="rounded-md border border-gray-900/[0.06] bg-gray-900/[0.03] px-1.5 py-0.5 text-[10px] font-medium capitalize text-gray-900/35 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/35">
            {agentId}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-xs text-gray-900/30 transition-colors hover:text-gray-900/70 dark:text-white/30 dark:hover:text-white/70"
        >
          Close
        </button>
      </div>

      <div className="px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 py-1 text-xs text-gray-900/30 dark:text-white/30">
            <span className="h-3 w-3 animate-spin rounded-full border border-gray-900/[0.12] border-t-gray-900/40 dark:border-white/[0.12] dark:border-t-white/40" />
            불러오는 중…
          </div>
        )}

        {error && (
          <p className="py-1 text-xs text-red-500">상태 조회 실패 — 서버 연결을 확인하세요.</p>
        )}

        {status && !loading && (
          <div className="flex flex-col gap-2">
            <StatusRow label="버전" value={status.version} />
            <StatusRow label="플랫폼" value={status.platform} />
            <StatusRow
              label="인증"
              value={
                status.auth.loggedIn
                  ? `로그인됨 (${status.auth.authMethod})`
                  : "로그아웃 상태"
              }
              accent={status.auth.loggedIn ? "green" : "red"}
            />
            {status.auth.email && <StatusRow label="계정" value={status.auth.email} />}
            {status.auth.orgName && <StatusRow label="조직" value={status.auth.orgName} />}
            {status.auth.subscriptionType && (
              <StatusRow label="구독" value={status.auth.subscriptionType} />
            )}
            <SessionCountRow count={status.activeSessions} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  const valueClass =
    accent === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "red"
        ? "text-red-500 dark:text-red-400"
        : "text-gray-900/70 dark:text-white/70";

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-gray-900/30 dark:text-white/30">
        {label}:
      </span>
      <span className={`text-xs font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function SessionCountRow({ count }: { count: number }) {
  const pct = Math.min(100, (count / 10) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-gray-900/30 dark:text-white/30">
        세션:
      </span>
      <div className="flex flex-1 items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-900/[0.07] dark:bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-orange-500/70 transition-all"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right font-mono text-[11px] text-gray-900/50 dark:text-white/50">
          {count}개 활성
        </span>
      </div>
    </div>
  );
}
