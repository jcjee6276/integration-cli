"use client";

import { useCallback, useEffect, useState } from "react";

import { getClaudeStatus, getGeminiAuthStatus } from "@/features/auth/api/auth.api";
import type { ClaudeStatus, GeminiAuthStatus } from "@/features/auth/api/auth.api";
import { Modal } from "@/components/ui/Modal";

// ─── Icons ────────────────────────────────────────────────────────────────────

const ClaudeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#D97757]">
    <path d="M13.827 3.816L20.05 20.2h-3.672l-1.234-3.365H8.856L7.622 20.2H3.95L10.173 3.816h3.654zm-1.827 4.91l-1.989 5.453h3.978l-1.989-5.453z" />
  </svg>
);

const GeminiIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const CodexIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-gray-400">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9 6.065 6.065 0 0 0-10.75 2.918 5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.985 5.985 0 0 0 .511 4.91 6.046 6.046 0 0 0 6.515 2.9 5.985 5.985 0 0 0 4.514 2.012 6.046 6.046 0 0 0 5.772-4.206 5.985 5.985 0 0 0 3.998-2.9 6.046 6.046 0 0 0-.747-7.071zM13.26 21.4a4.476 4.476 0 0 1-2.876-1.041l.141-.08 4.779-2.758a.775.775 0 0 0 .393-.681v-6.737l2.02 1.169a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.493zM3.6 17.275a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.775.775 0 0 0 .781 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-2.675zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973v5.701a.77.77 0 0 0 .388.677l5.815 3.354-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.787A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.843-3.354 2.02-1.169a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.695zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.775.775 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
  </svg>
);

const OpenCodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-400">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
    <line x1="12" y1="4" x2="12" y2="20" strokeWidth="1.4" strokeDasharray="2 2" />
  </svg>
);

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/[0.06] px-2 py-0.5 text-[11px] font-medium text-red-500 dark:text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      {label}
    </span>
  );
}

function ComingSoonBadge() {
  return (
    <span className="rounded-full border border-gray-900/[0.08] bg-gray-900/[0.04] px-2 py-0.5 text-[11px] font-medium text-gray-900/30 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/30">
      준비 중
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-900/35 dark:text-white/35">{label}</span>
      <span className="text-[11px] font-medium text-gray-900/65 dark:text-white/65">{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-900/[0.07] bg-gray-900/[0.02] p-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-900/[0.06] dark:bg-white/[0.06]" />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-900/[0.06] dark:bg-white/[0.06]" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-gray-900/[0.04] dark:bg-white/[0.04]" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-900/[0.04] dark:bg-white/[0.04]" />
      </div>
    </div>
  );
}

// ─── Agent Cards ──────────────────────────────────────────────────────────────

function ClaudeCard({ data, loading }: { data: ClaudeStatus | null; loading: boolean }) {
  if (loading) return <SkeletonCard />;

  const auth = data?.auth;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-orange-500/[0.12] bg-orange-500/[0.03] p-4 dark:border-orange-500/[0.10]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-900/[0.07] bg-orange-500/[0.10] dark:border-white/[0.07]">
          <ClaudeIcon />
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-gray-900/85 dark:text-white/85">Claude Code</span>
          <span className="text-[11px] text-gray-900/35 dark:text-white/35">Anthropic</span>
        </div>
        {data ? (
          <StatusBadge ok={auth?.loggedIn ?? false} label={auth?.loggedIn ? "인증됨" : "미인증"} />
        ) : (
          <StatusBadge ok={false} label="오프라인" />
        )}
      </div>

      {data && (
        <div className="flex flex-col gap-1.5 border-t border-gray-900/[0.06] pt-3 dark:border-white/[0.06]">
          <InfoRow label="버전" value={data.version} />
          <InfoRow label="플랫폼" value={data.platform} />
          <InfoRow label="활성 세션" value={`${data.activeSessions}개`} />
          {auth?.loggedIn && auth.email && <InfoRow label="계정" value={auth.email} />}
          {auth?.loggedIn && auth.orgName && <InfoRow label="조직" value={auth.orgName} />}
          {auth?.loggedIn && auth.subscriptionType && (
            <InfoRow label="구독" value={auth.subscriptionType} />
          )}
          {auth?.loggedIn && auth.authMethod && (
            <InfoRow label="인증 방식" value={auth.authMethod} />
          )}
        </div>
      )}
    </div>
  );
}

function GeminiCard({ data, loading }: { data: GeminiAuthStatus | null; loading: boolean }) {
  if (loading) return <SkeletonCard />;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-500/[0.12] bg-blue-500/[0.03] p-4 dark:border-blue-500/[0.10]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-900/[0.07] bg-blue-500/[0.08] dark:border-white/[0.07]">
          <GeminiIcon />
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-gray-900/85 dark:text-white/85">Gemini CLI</span>
          <span className="text-[11px] text-gray-900/35 dark:text-white/35">Google</span>
        </div>
        {data ? (
          data.installed ? (
            <StatusBadge ok={data.loggedIn} label={data.loggedIn ? "인증됨" : "미인증"} />
          ) : (
            <StatusBadge ok={false} label="미설치" />
          )
        ) : (
          <StatusBadge ok={false} label="오프라인" />
        )}
      </div>

      {data?.installed && (
        <div className="flex flex-col gap-1.5 border-t border-gray-900/[0.06] pt-3 dark:border-white/[0.06]">
          {data.email && <InfoRow label="계정" value={data.email} />}
          {data.authMethod && (
            <InfoRow
              label="인증 방식"
              value={data.authMethod === "api-key" ? "API Key" : data.authMethod === "gca" ? "Google 계정" : data.authMethod}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ComingSoonCard({
  icon,
  name,
  vendor,
  iconBg,
}: {
  icon: React.ReactNode;
  name: string;
  vendor: string;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-900/[0.07] bg-gray-900/[0.02] p-4 opacity-50 dark:border-white/[0.07] dark:bg-white/[0.02]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg border border-gray-900/[0.07] dark:border-white/[0.07] ${iconBg}`}>
        {icon}
      </span>
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-semibold text-gray-900/85 dark:text-white/85">{name}</span>
        <span className="text-[11px] text-gray-900/35 dark:text-white/35">{vendor}</span>
      </div>
      <ComingSoonBadge />
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface AgentStatusModalProps {
  open: boolean;
  onClose: () => void;
}

export function AgentStatusModal({ open, onClose }: AgentStatusModalProps) {
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<GeminiAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [claude, gemini] = await Promise.allSettled([getClaudeStatus(), getGeminiAuthStatus()]);
      setClaudeStatus(claude.status === "fulfilled" ? claude.value : null);
      setGeminiStatus(gemini.status === "fulfilled" ? gemini.value : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return (
    <Modal open={open} onClose={onClose} title="에이전트 상태" maxWidth="max-w-md">
      <div className="flex flex-col gap-3">
        {/* Refresh row */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-900/30 dark:text-white/30">
            현재 연결된 에이전트 상태입니다
          </span>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-900/45 transition-colors hover:border-gray-900/[0.14] hover:text-gray-900/75 disabled:cursor-default disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/45 dark:hover:border-white/[0.14] dark:hover:text-white/75"
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M13.836 2.477a.75.75 0 01.75.75V6.75a.75.75 0 01-.75.75H9.75a.75.75 0 010-1.5h2.765l-.927-.952a5.25 5.25 0 00-8.42 1.199.75.75 0 01-1.32-.71 6.75 6.75 0 0110.824-1.538l.929.952V3.227a.75.75 0 01.75-.75zm-13.08 8.797a.75.75 0 01.75-.75h4.086a.75.75 0 010 1.5H2.776l.927.952a5.25 5.25 0 008.42-1.199.75.75 0 011.32.71 6.75 6.75 0 01-10.824 1.538l-.929-.952v.951a.75.75 0 01-1.5 0V11.274a.75.75 0 01.75-.75l.006.75z"
                clipRule="evenodd"
              />
            </svg>
            새로고침
          </button>
        </div>

        {/* Agent cards */}
        <ClaudeCard data={claudeStatus} loading={loading} />
        <GeminiCard data={geminiStatus} loading={loading} />
        <ComingSoonCard
          icon={<CodexIcon />}
          name="Codex CLI"
          vendor="OpenAI"
          iconBg="bg-gray-900/[0.05] dark:bg-white/[0.06]"
        />
        <ComingSoonCard
          icon={<OpenCodeIcon />}
          name="OpenCode"
          vendor="OpenCode"
          iconBg="bg-emerald-500/[0.08]"
        />
      </div>
    </Modal>
  );
}
