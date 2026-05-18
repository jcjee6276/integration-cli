"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

type AuthBadge = "loading" | "authenticated" | "unauthenticated" | "unavailable";

function useClaudeAuthBadge(): AuthBadge {
  const [badge, setBadge] = useState<AuthBadge>("loading");

  useEffect(() => {
    fetch(`${SERVER_URL}/agents/claude/auth/status`)
      .then((r) => r.json())
      .then((d) => setBadge(d.loggedIn ? "authenticated" : "unauthenticated"))
      .catch(() => setBadge("unavailable"));
  }, []);

  return badge;
}

const BADGE_STYLES: Record<AuthBadge, { className: string; label: string }> = {
  loading: { className: "bg-gray-800 text-gray-500", label: "확인 중…" },
  authenticated: { className: "bg-green-900/50 text-green-400", label: "사용 가능" },
  unauthenticated: { className: "bg-yellow-900/50 text-yellow-400", label: "로그인 필요" },
  unavailable: { className: "bg-gray-800 text-gray-500", label: "서버 오류" },
};

export default function Home() {
  const claudeBadge = useClaudeAuthBadge();

  const agents = [
    {
      href: "/claude",
      name: "Claude CLI",
      description: "Anthropic Claude를 터미널에서 실행",
      color: "from-orange-500 to-amber-500",
      badge: claudeBadge,
      clickable: true,
    },
    {
      href: "#",
      name: "Gemini CLI",
      description: "Google Gemini 통합 (준비 중)",
      color: "from-blue-500 to-cyan-500",
      badge: "unavailable" as AuthBadge,
      clickable: false,
    },
    {
      href: "#",
      name: "Codex CLI",
      description: "OpenAI Codex 통합 (준비 중)",
      color: "from-green-500 to-emerald-500",
      badge: "unavailable" as AuthBadge,
      clickable: false,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d1117] p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">ji-cli</h1>
        <p className="mt-3 text-gray-400">하나의 플랫폼에서 모든 AI CLI를 제어합니다</p>
      </header>

      <div className="grid w-full max-w-2xl gap-4">
        {agents.map((agent) => {
          const { className: badgeClass, label: badgeLabel } = BADGE_STYLES[agent.badge];
          return (
            <Link
              key={agent.name}
              href={agent.href}
              aria-disabled={!agent.clickable}
              className={[
                "group relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900 p-6 transition-all",
                agent.clickable
                  ? "hover:border-gray-500 hover:shadow-lg hover:shadow-black/40"
                  : "cursor-not-allowed opacity-40",
              ].join(" ")}
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${agent.color}`}
              />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
                  <p className="mt-1 text-sm text-gray-400">{agent.description}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
                  {badgeLabel}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
