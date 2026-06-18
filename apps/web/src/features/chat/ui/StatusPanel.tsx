"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getClaudeStatus, getCodexStatus, getGeminiAuthStatus } from "@/features/auth/api/auth.api";
import type {
  AgentUsageStatus,
  AgentUsageWindow,
  ClaudeStatus,
  CodexStatus,
  GeminiAuthStatus,
} from "@/features/auth/api/auth.api";

type StatusAgentId = "claude" | "codex" | "gemini";

interface Props {
  agentId: string;
  onClose: () => void;
}

interface StatusState {
  claude: ClaudeStatus | null;
  codex: CodexStatus | null;
  gemini: GeminiAuthStatus | null;
}

const AGENT_TABS: { id: StatusAgentId; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini" },
];

function toStatusAgentId(agentId: string): StatusAgentId {
  if (agentId === "codex" || agentId === "gemini") return agentId;
  return "claude";
}

export function StatusPanel({ agentId, onClose }: Props) {
  const [activeAgent, setActiveAgent] = useState<StatusAgentId>(() => toStatusAgentId(agentId));
  const [status, setStatus] = useState<StatusState>({ claude: null, codex: null, gemini: null });
  const [loading, setLoading] = useState(true);
  const [errorByAgent, setErrorByAgent] = useState<Partial<Record<StatusAgentId, boolean>>>({});

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setErrorByAgent({});

    try {
      const [claude, codex, gemini] = await Promise.allSettled([
        getClaudeStatus(),
        getCodexStatus(),
        getGeminiAuthStatus(),
      ]);

      setStatus({
        claude: claude.status === "fulfilled" ? claude.value : null,
        codex: codex.status === "fulfilled" ? codex.value : null,
        gemini: gemini.status === "fulfilled" ? gemini.value : null,
      });
      setErrorByAgent({
        claude: claude.status === "rejected",
        codex: codex.status === "rejected",
        gemini: gemini.status === "rejected",
      });
    } catch {
      setStatus({ claude: null, codex: null, gemini: null });
      setErrorByAgent({ claude: true, codex: true, gemini: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  const content = useMemo(() => {
    if (loading) return <LoadingStatus />;
    if (errorByAgent[activeAgent]) return <ErrorState onRetry={loadStatus} />;

    if (activeAgent === "claude") return <ClaudeStatusView data={status.claude} />;
    if (activeAgent === "codex") return <CodexStatusView data={status.codex} />;
    return <GeminiStatusView data={status.gemini} />;
  }, [activeAgent, errorByAgent, loadStatus, loading, status]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-900/[0.08] bg-white shadow-[0_8px_32px_-4px_rgba(0,0,0,0.10)] dark:border-white/[0.08] dark:bg-[#0e1117] dark:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-gray-900/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">Status</span>
          <div className="flex min-w-0 items-center gap-1 rounded-lg border border-gray-900/[0.06] bg-gray-900/[0.03] p-0.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            {AGENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveAgent(tab.id)}
                className={`h-7 shrink-0 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors ${
                  activeAgent === tab.id
                    ? "bg-white text-gray-900/80 shadow-sm dark:bg-white/[0.10] dark:text-white/85"
                    : "text-gray-900/35 hover:text-gray-900/65 dark:text-white/35 dark:hover:text-white/65"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer text-xs text-gray-900/30 transition-colors hover:text-gray-900/70 dark:text-white/30 dark:hover:text-white/70"
        >
          Close
        </button>
      </div>

      <div className="px-4 py-3">{content}</div>
    </div>
  );
}

function ClaudeStatusView({ data }: { data: ClaudeStatus | null }) {
  if (!data) return <ErrorState />;
  if (!data.auth.loggedIn) return <AuthRequired title="Claude 인증이 필요합니다" />;

  return (
    <div className="flex flex-col gap-2">
      <StatusRow label="버전" value={data.version} />
      <StatusRow label="플랫폼" value={data.platform} />
      <StatusRow label="인증" value={`로그인됨 (${data.auth.authMethod})`} accent="green" />
      {data.auth.email && <StatusRow label="계정" value={data.auth.email} />}
      {data.auth.orgName && <StatusRow label="조직" value={data.auth.orgName} />}
      {data.auth.subscriptionType && <StatusRow label="구독" value={data.auth.subscriptionType} />}
      <UsageRow usage={data.usage} />
      <SessionCountRow count={data.activeSessions} colorClass="bg-orange-500/70" />
    </div>
  );
}

function CodexStatusView({ data }: { data: CodexStatus | null }) {
  if (!data) return <ErrorState />;
  if (!data.auth.installed) return <AuthRequired title="Codex CLI 설치가 필요합니다" />;
  if (!data.auth.loggedIn) return <AuthRequired title="Codex 인증이 필요합니다" />;

  return (
    <div className="flex flex-col gap-2">
      <StatusRow label="버전" value={data.version} />
      <StatusRow label="플랫폼" value={data.platform} />
      <StatusRow
        label="인증"
        value={`로그인됨 (${data.auth.authMethod ?? "unknown"})`}
        accent="green"
      />
      <UsageRow usage={data.usage} />
      <SessionCountRow count={data.activeSessions} colorClass="bg-gray-500/70" />
    </div>
  );
}

function GeminiStatusView({ data }: { data: GeminiAuthStatus | null }) {
  if (!data) return <ErrorState />;
  if (!data.installed) return <AuthRequired title="Gemini CLI 설치가 필요합니다" />;
  if (!data.loggedIn) return <AuthRequired title="Gemini 인증이 필요합니다" />;

  return (
    <div className="flex flex-col gap-2">
      <StatusRow
        label="인증"
        value={`로그인됨 (${formatGeminiAuth(data.authMethod)})`}
        accent="green"
      />
      {data.email && <StatusRow label="계정" value={data.email} />}
      <StatusRow label="사용량" value="Gemini usage는 아직 지원하지 않습니다" />
    </div>
  );
}

function LoadingStatus() {
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-gray-900/30 dark:text-white/30">
      <span className="h-3 w-3 animate-spin rounded-full border border-gray-900/[0.12] border-t-gray-900/40 dark:border-white/[0.12] dark:border-t-white/40" />
      불러오는 중...
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <p className="text-xs text-red-500">상태 조회 실패 - 서버 연결을 확인하세요.</p>
      {onRetry && (
        <button
          type="button"
          onClick={() => void onRetry()}
          className="shrink-0 cursor-pointer rounded-lg border border-red-500/20 px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-500/[0.06]"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

function AuthRequired({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{title}</p>
      <p className="mt-1 text-[11px] text-gray-900/45 dark:text-white/45">
        메인 인증 화면에서 인증을 완료한 뒤 다시 확인하세요.
      </p>
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
      <span className={`min-w-0 text-xs font-medium break-words ${valueClass}`}>{value}</span>
    </div>
  );
}

function UsageRow({ usage }: { usage: AgentUsageStatus }) {
  const percent =
    typeof usage.percent === "number" ? Math.min(100, Math.max(0, usage.percent)) : null;

  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-gray-900/30 dark:text-white/30">
        사용량:
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              usage.available
                ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                : "border-gray-900/[0.08] bg-gray-900/[0.03] text-gray-900/45 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/45"
            }`}
          >
            {usage.available ? "확인됨" : "조회 불가"}
          </span>
          <span className="min-w-0 text-xs font-medium text-gray-900/70 dark:text-white/70">
            {usage.label}
          </span>
        </div>
        {percent !== null && (
          <div className="relative h-2 overflow-hidden rounded-full bg-gray-900/[0.07] dark:bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {usage.resetAt && (
          <span className="text-[11px] text-gray-900/40 dark:text-white/40">
            리셋: {usage.resetAt}
          </span>
        )}
        {!!usage.windows?.length && (
          <div className="mt-1 flex flex-col gap-1.5">
            {usage.windows.map((window) => (
              <UsageWindowGraph key={window.label} window={window} />
            ))}
          </div>
        )}
        {usage.details?.map((detail) => (
          <span key={detail} className="text-[11px] text-gray-900/40 dark:text-white/40">
            {detail}
          </span>
        ))}
      </div>
    </div>
  );
}

function UsageWindowGraph({ window }: { window: AgentUsageWindow }) {
  const usedPercent =
    typeof window.percent === "number" ? Math.min(100, Math.max(0, window.percent)) : null;

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_7rem] items-center gap-2">
      <span className="shrink-0 font-mono text-[11px] text-gray-900/40 dark:text-white/40">
        {window.label}:
      </span>
      <div className="flex h-3 min-w-0 overflow-hidden rounded-[3px] border border-gray-900/[0.04] bg-gray-900/[0.06] dark:border-white/[0.05] dark:bg-white/[0.06]">
        {window.points.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            title={`${point.label} ${formatCompactCount(point.value)} tokens`}
            className="min-w-0 flex-1 border-r border-white/25 last:border-r-0 dark:border-black/25"
            style={{
              backgroundColor: `rgba(17, 24, 39, ${0.12 + (point.percent / 100) * 0.76})`,
            }}
          />
        ))}
        {window.points.length === 0 && <span className="h-full flex-1 bg-gray-900/[0.08]" />}
      </div>
      <div className="min-w-0 text-right font-mono text-[11px] leading-3 text-gray-900/70 dark:text-white/70">
        <div className="truncate">
          {usedPercent !== null ? `${usedPercent}% used` : window.valueLabel}
        </div>
        <div className="truncate text-gray-900/35 dark:text-white/35">
          {window.resetAt ? `resets ${window.resetAt}` : window.limitLabel}
        </div>
      </div>
    </div>
  );
}

function SessionCountRow({ count, colorClass }: { count: number; colorClass: string }) {
  const pct = Math.min(100, (count / 10) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-gray-900/30 dark:text-white/30">
        세션:
      </span>
      <div className="flex flex-1 items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-900/[0.07] dark:bg-white/[0.07]">
          <div
            className={`h-full rounded-full transition-all ${colorClass}`}
            style={{ width: `${count === 0 ? 4 : Math.max(4, pct)}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right font-mono text-[11px] text-gray-900/50 dark:text-white/50">
          {count}개 활성
        </span>
      </div>
    </div>
  );
}

function formatCompactCount(value: number) {
  try {
    return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(
      value,
    );
  } catch {
    return `${value}`;
  }
}

function formatGeminiAuth(authMethod: string) {
  if (authMethod === "api-key") return "API Key";
  if (authMethod === "gca") return "Google 계정";
  return authMethod;
}
