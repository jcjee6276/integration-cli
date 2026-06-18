"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useClaudeAuth } from "@/features/auth/hooks/useClaudeAuth";
import { useGeminiAuth } from "@/features/auth/hooks/useGeminiAuth";
import { useCodexAuth } from "@/features/auth/hooks/useCodexAuth";
import { LoginPanel } from "@/features/auth/ui/LoginPanel";
import { GeminiLoginPanel } from "@/features/auth/ui/GeminiLoginPanel";
import { CodexLoginPanel } from "@/features/auth/ui/CodexLoginPanel";
import { Modal } from "@/components/ui/Modal";
import { ThemeToggle } from "@/lib/theme";

type AgentKey = "claude" | "gemini" | "codex";
type AuthBadge = "loading" | "authenticated" | "unauthenticated" | "unavailable";

// ─── 에이전트 인증 상태 → Badge 변환 ─────────────────────────────────────────

function toBadge(state: string): AuthBadge {
  if (state === "checking") return "loading";
  if (state === "authenticated") return "authenticated";
  if (state === "not-installed") return "unavailable";
  return "unauthenticated";
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<
  AuthBadge,
  { border: string; bg: string; text: string; dot: string; label: string }
> = {
  loading: {
    border: "border-gray-900/[0.07] dark:border-white/[0.07]",
    bg: "bg-gray-900/[0.04] dark:bg-white/[0.04]",
    text: "text-transparent",
    dot: "bg-gray-900/20 dark:bg-white/20",
    label: "확인 중",
  },
  authenticated: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/[0.08]",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500 shadow-[0_0_5px_#34d399] dark:bg-emerald-400",
    label: "사용 가능",
  },
  unauthenticated: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/[0.08]",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500 dark:bg-amber-400",
    label: "로그인 필요",
  },
  unavailable: {
    border: "border-gray-900/[0.06] dark:border-white/[0.06]",
    bg: "bg-gray-900/[0.03] dark:bg-white/[0.03]",
    text: "text-gray-900/30 dark:text-white/30",
    dot: "bg-gray-900/20 dark:bg-white/20",
    label: "미설치",
  },
};

function Badge({ badge }: { badge: AuthBadge }) {
  const { border, bg, text, dot, label } = BADGE_CONFIG[badge];
  const isPulsing = badge === "loading" || badge === "authenticated";
  return (
    <span
      className={[
        "inline-flex min-w-[86px] shrink-0 items-center justify-center gap-1.5",
        "rounded-full border px-3 py-[5px] text-xs font-medium",
        "transition-all duration-500",
        border, bg, text,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", dot, isPulsing ? "animate-pulse" : ""].join(" ")} />
      {label}
    </span>
  );
}

// ─── 에이전트 아이콘 ──────────────────────────────────────────────────────────

const CLAUDE_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#D97757]" aria-hidden="true">
    <path d="M13.827 3.816L20.05 20.2h-3.672l-1.234-3.365H8.856L7.622 20.2H3.95L10.173 3.816h3.654zm-1.827 4.91l-1.989 5.453h3.978l-1.989-5.453z" />
  </svg>
);

const GEMINI_ICON = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const CODEX_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-gray-900/70 dark:text-white/70" aria-hidden="true">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

const AGENT_META: Record<
  AgentKey,
  { name: string; description: string; icon: React.ReactNode; iconBg: string; accentFrom: string; accentVia: string }
> = {
  claude: {
    name: "Claude CLI",
    description: "Anthropic Claude Code",
    icon: CLAUDE_ICON,
    iconBg: "bg-orange-500/[0.10]",
    accentFrom: "from-orange-500/[0.10]",
    accentVia: "via-orange-400/50",
  },
  gemini: {
    name: "Gemini CLI",
    description: "Google Gemini",
    icon: GEMINI_ICON,
    iconBg: "bg-blue-500/[0.08]",
    accentFrom: "from-blue-500/[0.10]",
    accentVia: "via-blue-400/40",
  },
  codex: {
    name: "Codex CLI",
    description: "OpenAI Codex",
    icon: CODEX_ICON,
    iconBg: "bg-gray-900/[0.05] dark:bg-white/[0.05]",
    accentFrom: "from-gray-500/[0.07]",
    accentVia: "via-gray-400/25",
  },
};

// ─── 에이전트 인증 카드 ───────────────────────────────────────────────────────

interface AgentAuthCardProps {
  agentKey: AgentKey;
  badge: AuthBadge;
  onAuth: () => void;
  index: number;
}

function AgentAuthCard({ agentKey, badge, onAuth, index }: AgentAuthCardProps) {
  const meta = AGENT_META[agentKey];
  const canAuth = badge === "unauthenticated" || badge === "loading";
  const isAuth = badge === "authenticated";

  return (
    <div
      className={[
        "animate-fade-in-up relative overflow-hidden rounded-2xl",
        "border border-gray-900/[0.07] dark:border-white/[0.07]",
        "bg-gray-900/[0.025] dark:bg-white/[0.025]",
        "p-4 transition-all duration-300",
      ].join(" ")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* 상단 accent 라인 */}
      <div
        className={[
          "absolute inset-x-0 top-0 h-px",
          "bg-gradient-to-r from-transparent to-transparent",
          meta.accentVia,
        ].join(" ")}
      />
      {/* 상단 ambient tint */}
      <div
        className={[
          "pointer-events-none absolute inset-x-0 top-0 h-20",
          `bg-gradient-to-b ${meta.accentFrom} to-transparent opacity-50`,
        ].join(" ")}
      />

      <div className="relative flex items-center justify-between gap-3">
        {/* 왼쪽: 아이콘 + 이름 */}
        <div className="flex items-center gap-3 min-w-0">
          <span className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.iconBg].join(" ")}>
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-gray-900/85 dark:text-white/85">{meta.name}</p>
            <p className="text-[12px] text-gray-900/35 dark:text-white/35">{meta.description}</p>
          </div>
        </div>

        {/* 오른쪽: 배지 + 인증 버튼 */}
        <div className="flex shrink-0 items-center gap-2">
          <Badge badge={badge} />
          {!isAuth && badge !== "unavailable" && (
            <button
              onClick={onAuth}
              disabled={!canAuth}
              className={[
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                canAuth
                  ? "border-gray-900/[0.10] bg-gray-900/[0.04] text-gray-900/60 hover:border-gray-900/[0.18] hover:bg-gray-900/[0.08] hover:text-gray-900/90 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/60 dark:hover:border-white/[0.18] dark:hover:bg-white/[0.08] dark:hover:text-white/90"
                  : "cursor-not-allowed border-gray-900/[0.06] bg-gray-900/[0.02] text-gray-900/25 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white/25",
              ].join(" ")}
            >
              인증하기
            </button>
          )}
          {isAuth && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/[0.10]">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400">
                <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Claude 페이지 진입 버튼 ─────────────────────────────────────────────────

function ClaudeEntryButton({ canEnter, isLoading }: { canEnter: boolean; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-fade-in-up flex h-[60px] w-full max-w-[460px] items-center justify-center rounded-2xl border border-gray-900/[0.07] bg-gray-900/[0.025] dark:border-white/[0.07] dark:bg-white/[0.025]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-orange-500 dark:border-white/[0.08]" />
      </div>
    );
  }

  if (canEnter) {
    return (
      <Link
        href="/claude"
        className={[
          "animate-fade-in-up group relative flex w-full max-w-[460px] items-center justify-between overflow-hidden",
          "rounded-2xl px-6 py-4 transition-all duration-300",
          "bg-gradient-to-r from-orange-600 to-orange-500",
          "shadow-[0_4px_20px_-2px_rgba(234,88,12,0.30)] hover:shadow-[0_8px_28px_-2px_rgba(234,88,12,0.40)]",
          "hover:from-orange-500 hover:to-orange-400",
        ].join(" ")}
        style={{ animationDelay: "180ms" }}
      >
        {/* 배경 반짝임 */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/[0.07] to-transparent" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.18]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5 text-white">
              <path d="M13.827 3.816L20.05 20.2h-3.672l-1.234-3.365H8.856L7.622 20.2H3.95L10.173 3.816h3.654zm-1.827 4.91l-1.989 5.453h3.978l-1.989-5.453z" />
            </svg>
          </span>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-white">JC CLI 시작하기</p>
            <p className="text-[11px] text-white/60">멀티 에이전트 채팅 시작</p>
          </div>
        </div>

        <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.15] transition-transform duration-200 group-hover:translate-x-0.5">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-white">
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </Link>
    );
  }

  return (
    <div className="animate-fade-in-up flex w-full max-w-[460px] flex-col items-center gap-2" style={{ animationDelay: "180ms" }}>
      <div
        className={[
          "relative flex w-full items-center justify-between overflow-hidden",
          "rounded-2xl border border-gray-900/[0.07] bg-gray-900/[0.025] px-6 py-4",
          "dark:border-white/[0.07] dark:bg-white/[0.025]",
          "opacity-40 cursor-not-allowed",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-gray-900/40 dark:text-white/40">
              <path fillRule="evenodd" d="M8 1a3.5 3.5 0 00-3.5 3.5V7A1.5 1.5 0 003 8.5v5A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-5A1.5 1.5 0 0011.5 7V4.5A3.5 3.5 0 008 1zm2 6V4.5a2 2 0 10-4 0V7h4z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-gray-900/60 dark:text-white/60">JC CLI 시작하기</p>
            <p className="text-[11px] text-gray-900/30 dark:text-white/30">멀티 에이전트 채팅 시작</p>
          </div>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-gray-900/30 dark:text-white/30">
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      <p className="text-[12px] text-gray-900/30 dark:text-white/30">
        에이전트를 하나 이상 인증해야 시작할 수 있습니다
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const claude = useClaudeAuth();
  const gemini = useGeminiAuth();
  const codex = useCodexAuth();

  const [modalOpen, setModalOpen] = useState<AgentKey | null>(null);

  // 인증 완료 시 모달 자동 닫기 (1.2초 후)
  useEffect(() => {
    if (modalOpen === "claude" && claude.loginState === "done") {
      const t = setTimeout(() => setModalOpen(null), 1200);
      return () => clearTimeout(t);
    }
  }, [claude.loginState, modalOpen]);

  useEffect(() => {
    if (modalOpen === "gemini" && gemini.loginState === "done") {
      const t = setTimeout(() => setModalOpen(null), 1200);
      return () => clearTimeout(t);
    }
  }, [gemini.loginState, modalOpen]);

  useEffect(() => {
    if (
      modalOpen === "codex" &&
      (codex.loginState === "done" || codex.apiKeyLoginState === "done")
    ) {
      const t = setTimeout(() => setModalOpen(null), 1200);
      return () => clearTimeout(t);
    }
  }, [codex.loginState, codex.apiKeyLoginState, modalOpen]);

  // 모달 닫기 핸들러 (진행 중인 인증 취소 포함)
  const handleCloseModal = () => {
    if (modalOpen === "claude") claude.cancelLogin();
    if (modalOpen === "gemini") gemini.cancelLogin();
    if (modalOpen === "codex") codex.cancelDeviceLogin();
    setModalOpen(null);
  };

  const claudeBadge = toBadge(claude.authState);
  const geminiBadge = toBadge(gemini.authState);
  const codexBadge = toBadge(codex.authState);

  const isAnyAuthenticated =
    claudeBadge === "authenticated" ||
    geminiBadge === "authenticated" ||
    codexBadge === "authenticated";

  const isChecking =
    claudeBadge === "loading" ||
    geminiBadge === "loading" ||
    codexBadge === "loading";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#faf8f5] px-6 py-12 dark:bg-[#07090e]">

      {/* 테마 토글 */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* 배경 glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[40%] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.04] blur-[120px] dark:bg-orange-500/[0.035]" />
        <div className="absolute -left-24 bottom-1/4 h-[350px] w-[450px] rounded-full bg-blue-600/[0.03] blur-[100px] dark:bg-blue-600/[0.025]" />
        <div className="absolute -right-24 top-1/4 h-[300px] w-[400px] rounded-full bg-purple-600/[0.03] blur-[100px] dark:bg-purple-600/[0.025]" />
      </div>

      {/* dot-grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle, var(--dot-color) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* 헤더 */}
      <header className="animate-fade-in-up relative mb-10 flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className="flex h-12 w-80 items-center justify-center rounded-[16px] border border-gray-900/[0.10] bg-gray-900/[0.05] shadow-[inset_0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/[0.10] dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <span className="font-mono text-sm font-bold tracking-widest text-gray-900/65 dark:text-white/65">
              INTEGRATION-CLI
            </span>
          </div>
          <div className="absolute -inset-2 rounded-[20px] bg-orange-500/10 blur-xl" />
        </div>
        <div>
          <h1
            className="text-[2.75rem] font-bold leading-none tracking-[-0.03em]"
            style={{
              background: "var(--heading-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            JC-CLI
          </h1>
          <p className="mt-2.5 text-[13px] font-medium uppercase tracking-[0.06em] text-gray-900/28 dark:text-white/28">
            하나의 플랫폼에서 모든 AI CLI를 제어합니다
          </p>
        </div>
      </header>

      {/* 본문 */}
      <div className="relative flex w-full max-w-[460px] flex-col gap-3">

        {/* ── 에이전트 인증 섹션 ──────────────────────────────────────────── */}
        <div className="animate-fade-in-up mb-1 flex items-center gap-2" style={{ animationDelay: "60ms" }}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900/35 dark:text-white/35">
            에이전트 인증
          </span>
          <div className="h-px flex-1 bg-gray-900/[0.06] dark:bg-white/[0.06]" />
        </div>

        <AgentAuthCard
          agentKey="claude"
          badge={claudeBadge}
          onAuth={() => setModalOpen("claude")}
          index={0}
        />
        <AgentAuthCard
          agentKey="gemini"
          badge={geminiBadge}
          onAuth={() => setModalOpen("gemini")}
          index={1}
        />
        <AgentAuthCard
          agentKey="codex"
          badge={codexBadge}
          onAuth={() => setModalOpen("codex")}
          index={2}
        />

        {/* ── 구분선 ──────────────────────────────────────────────────────── */}
        <div className="animate-fade-in-up my-1 flex items-center gap-2" style={{ animationDelay: "150ms" }}>
          <div className="h-px flex-1 bg-gray-900/[0.06] dark:bg-white/[0.06]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900/35 dark:text-white/35">
            시작하기
          </span>
          <div className="h-px flex-1 bg-gray-900/[0.06] dark:bg-white/[0.06]" />
        </div>

        {/* ── Claude 페이지 진입 버튼 ─────────────────────────────────────── */}
        <ClaudeEntryButton canEnter={isAnyAuthenticated} isLoading={isChecking} />
      </div>

      {/* 하단 rule */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-900/[0.05] to-transparent dark:via-white/[0.05]" />

      {/* ── Claude 인증 모달 ────────────────────────────────────────────────── */}
      <Modal open={modalOpen === "claude"} onClose={handleCloseModal} title="Claude CLI 인증" maxWidth="max-w-lg">
        <LoginPanel
          loginState={claude.loginState}
          loginOutput={claude.loginOutput}
          loginUrls={claude.loginUrls}
          onStart={claude.startLogin}
          onCancel={() => { claude.cancelLogin(); setModalOpen(null); }}
        />
      </Modal>

      {/* ── Gemini 인증 모달 ────────────────────────────────────────────────── */}
      <Modal open={modalOpen === "gemini"} onClose={handleCloseModal} title="Gemini CLI 인증" maxWidth="max-w-lg">
        <GeminiLoginPanel
          loginState={gemini.loginState}
          loginOutput={gemini.loginOutput}
          loginUrls={gemini.loginUrls}
          configError={gemini.configError}
          onSaveApiKey={gemini.saveApiKey}
          onStartGca={gemini.startGcaLogin}
          onCancel={() => { gemini.cancelLogin(); setModalOpen(null); }}
          onReset={gemini.resetLogin}
        />
      </Modal>

      {/* ── Codex 인증 모달 ─────────────────────────────────────────────────── */}
      <Modal open={modalOpen === "codex"} onClose={handleCloseModal} title="Codex CLI 인증" maxWidth="max-w-lg">
        <CodexLoginPanel
          loginMethod={codex.loginMethod}
          onMethodChange={codex.setLoginMethod}
          loginState={codex.loginState}
          loginOutput={codex.loginOutput}
          loginUrls={codex.loginUrls}
          deviceCode={codex.deviceCode}
          onStartDeviceLogin={codex.startDeviceLogin}
          onCancelDeviceLogin={() => { codex.cancelDeviceLogin(); setModalOpen(null); }}
          apiKeyLoginState={codex.apiKeyLoginState}
          configError={codex.configError}
          onSaveApiKey={codex.saveApiKey}
        />
      </Modal>
    </div>
  );
}
