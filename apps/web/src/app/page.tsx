"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getAuthStatus } from "@/features/auth/api/auth.api";

type AuthBadge = "loading" | "authenticated" | "unauthenticated" | "unavailable";

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useClaudeAuthBadge(): AuthBadge {
  const [badge, setBadge] = useState<AuthBadge>("loading");

  useEffect(() => {
    getAuthStatus()
      .then((d) => setBadge(d.loggedIn ? "authenticated" : "unauthenticated"))
      .catch(() => setBadge("unavailable"));
  }, []);

  return badge;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  badge: AuthBadge;
}

const BADGE_CONFIG: Record<
  AuthBadge,
  { border: string; bg: string; text: string; dot: string; label: string }
> = {
  loading: {
    border: "border-white/[0.07]",
    bg: "bg-white/[0.04]",
    text: "text-transparent",
    dot: "bg-white/20",
    label: "로그인 필요",
  },
  authenticated: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/[0.08]",
    text: "text-emerald-400",
    dot: "bg-emerald-400 shadow-[0_0_5px_#34d399]",
    label: "사용 가능",
  },
  unauthenticated: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/[0.08]",
    text: "text-amber-400",
    dot: "bg-amber-400",
    label: "로그인 필요",
  },
  unavailable: {
    border: "border-white/[0.06]",
    bg: "bg-white/[0.03]",
    text: "text-white/30",
    dot: "bg-white/20",
    label: "준비 중",
  },
};

function Badge({ badge }: BadgeProps) {
  const { border, bg, text, dot, label } = BADGE_CONFIG[badge];
  const isPulsing = badge === "loading" || badge === "authenticated";

  return (
    <span
      className={[
        "inline-flex min-w-[88px] shrink-0 items-center justify-center gap-1.5",
        "rounded-full border px-3 py-[5px] text-xs font-medium",
        "transition-all duration-500",
        border,
        bg,
        text,
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          dot,
          isPulsing ? "animate-pulse" : "",
        ].join(" ")}
      />
      {label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* shimmer sweep */}
      <div className="animate-shimmer-bg absolute inset-0" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div
            className="h-[15px] w-28 rounded-md bg-white/[0.07]"
            style={{ animationDelay: `${index * 60}ms` }}
          />
          <div
            className="h-3 w-48 rounded-md bg-white/[0.04]"
            style={{ animationDelay: `${index * 60 + 80}ms` }}
          />
        </div>
        {/* badge placeholder — matches min-w-[88px] of real badge */}
        <div className="h-[26px] min-w-[88px] rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

interface AgentCardProps {
  href: string;
  name: string;
  description: string;
  accentFrom: string;
  accentVia: string;
  hoverShadow: string;
  clickable: boolean;
  badge: AuthBadge;
  index: number;
}

function AgentCard({
  href,
  name,
  description,
  accentFrom,
  accentVia,
  hoverShadow,
  clickable,
  badge,
  index,
}: AgentCardProps) {
  return (
    <Link
      href={href}
      aria-disabled={!clickable}
      tabIndex={clickable ? undefined : -1}
      className={[
        "animate-fade-in-up group relative overflow-hidden rounded-2xl",
        "border border-white/[0.07] bg-white/[0.025]",
        "p-6 transition-all duration-300",
        clickable
          ? `hover:border-white/[0.12] hover:bg-white/[0.04] ${hoverShadow}`
          : "pointer-events-none opacity-40",
      ].join(" ")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top accent bar */}
      <div
        className={[
          "absolute inset-x-0 top-0 h-px",
          "bg-gradient-to-r from-transparent to-transparent",
          accentVia,
        ].join(" ")}
      />

      {/* Ambient tint — always visible; intensifies on hover for clickable cards */}
      <div
        className={[
          "absolute inset-x-0 top-0 h-32",
          `bg-gradient-to-b ${accentFrom} to-transparent`,
          clickable
            ? "opacity-60 transition-opacity duration-500 group-hover:opacity-100"
            : "opacity-40",
        ].join(" ")}
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-white/90">
            {name}
          </h2>
          <p className="mt-0.5 truncate text-[13px] leading-relaxed text-white/35">
            {description}
          </p>
        </div>

        <Badge badge={badge} />
      </div>

      {/* Arrow indicator */}
      {clickable && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-25">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-white">
            <path
              fillRule="evenodd"
              d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </Link>
  );
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

type AgentDef = Omit<AgentCardProps, "badge" | "index"> & {
  isDynamic: boolean;
  staticBadge?: AuthBadge;
};

const AGENTS: AgentDef[] = [
  {
    href: "/claude",
    name: "Claude CLI",
    description: "Anthropic Claude를 터미널에서 실행",
    accentFrom: "from-orange-500/[0.13]",
    accentVia: "via-orange-400/60",
    hoverShadow: "hover:shadow-[0_8px_32px_-4px_rgba(249,115,22,0.12)]",
    clickable: true,
    isDynamic: true,
  },
  {
    href: "#",
    name: "Gemini CLI",
    description: "Google Gemini 통합 (준비 중)",
    accentFrom: "from-blue-500/[0.13]",
    accentVia: "via-blue-400/40",
    hoverShadow: "hover:shadow-[0_8px_32px_-4px_rgba(59,130,246,0.12)]",
    clickable: false,
    isDynamic: false,
    staticBadge: "unavailable",
  },
  {
    href: "#",
    name: "Codex CLI",
    description: "OpenAI Codex 통합 (준비 중)",
    accentFrom: "from-emerald-500/[0.13]",
    accentVia: "via-emerald-400/40",
    hoverShadow: "hover:shadow-[0_8px_32px_-4px_rgba(16,185,129,0.12)]",
    clickable: false,
    isDynamic: false,
    staticBadge: "unavailable",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const claudeBadge = useClaudeAuthBadge();
  const isLoading = claudeBadge === "loading";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07090e] px-6 py-12">

      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[40%] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.035] blur-[120px]" />
        <div className="absolute -left-24 bottom-1/4 h-[350px] w-[450px] rounded-full bg-blue-600/[0.025] blur-[100px]" />
        <div className="absolute -right-24 top-1/4 h-[300px] w-[400px] rounded-full bg-purple-600/[0.025] blur-[100px]" />
      </div>

      {/* Dot-grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Header */}
      <header className="animate-fade-in-up relative mb-10 flex flex-col items-center gap-5 text-center">
        {/* Logo mark */}
        <div className="relative">
          <div className="flex h-12 w-60 items-center justify-center rounded-[16px] border border-white/[0.10] bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
            <span className="font-mono text-sm font-bold tracking-widest text-white/65">
            integration-CLI
            </span>
          </div>
          <div className="absolute -inset-2 rounded-[20px] bg-orange-500/10 blur-xl" />
        </div>

        <div>
          <h1
            className="text-[2.75rem] font-bold leading-none tracking-[-0.03em]"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            JI-CLI
          </h1>
          <p className="mt-2.5 text-[13px] font-medium tracking-[0.06em] text-white/28 uppercase">
            하나의 플랫폼에서 모든 AI CLI를 제어합니다
          </p>
        </div>
      </header>

      {/* Card list */}
      <div className="relative flex flex-col w-full max-w-[460px] space-y-2">
        {isLoading
          ? AGENTS.map((_, i) => <SkeletonCard key={i} index={i} />)
          : AGENTS.map((agent, i) => (
              <AgentCard
                key={agent.name}
                {...agent}
                index={i}
                badge={agent.isDynamic ? claudeBadge : (agent.staticBadge ?? "unavailable")}
              />
            ))}
      </div>

      {/* Bottom rule */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}
