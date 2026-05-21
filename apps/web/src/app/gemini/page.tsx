"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useGeminiAuth } from "@/features/auth/hooks/useGeminiAuth";
import { GeminiLoginPanel } from "@/features/auth/ui/GeminiLoginPanel";
import { ThemeToggle } from "@/lib/theme";

// ─── Checking Skeleton ────────────────────────────────────────────────────────

function CheckingSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-[#faf8f5] dark:bg-[#07090e]">
      <div className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
        <div className="h-3.5 w-3.5 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
        <div className="h-[14px] w-20 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-blue-500 dark:border-white/[0.08]" />
        <span className="text-xs text-gray-900/20 dark:text-white/20">인증 확인 중…</span>
      </div>
    </div>
  );
}

// ─── Not Installed ────────────────────────────────────────────────────────────

function NotInstalledView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gray-900/30 dark:text-white/30">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900/90 dark:text-white/90">Gemini CLI가 설치되어 있지 않습니다</h2>
        <p className="max-w-sm text-sm text-gray-900/40 dark:text-white/40">
          먼저 CLI 도구를 설치해 주세요.
        </p>
        <code className="mt-1 rounded-lg border border-gray-900/[0.08] bg-gray-900/[0.03] px-4 py-2 font-mono text-sm text-gray-900/55 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/55">
          jccli init
        </code>
      </div>
    </div>
  );
}

// ─── Authenticated View ───────────────────────────────────────────────────────

function AuthenticatedView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-[120px]" />
      </div>
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-blue-500/[0.08] dark:border-white/[0.08]">
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      </div>
      <div className="relative text-center">
        <p className="font-semibold text-gray-900/75 dark:text-white/75">Gemini CLI</p>
        <p className="mt-1 text-sm text-gray-900/30 dark:text-white/30">로그인되었습니다. 채팅 기능은 준비 중입니다.</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeminiPage() {
  const {
    authState,
    loginState,
    loginOutput,
    loginUrls,
    configError,
    saveApiKey,
    startGcaLogin,
    cancelLogin,
    resetLogin,
    checkAuth,
  } = useGeminiAuth();

  useEffect(() => {
    if (loginState === "done") void checkAuth();
  }, [loginState, checkAuth]);

  const pageHeader = (
    <header className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
      <Link href="/" className="text-gray-900/30 transition-colors hover:text-gray-900/60 dark:text-white/30 dark:hover:text-white/60">
        ←
      </Link>
      <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">Gemini CLI</span>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );

  if (authState === "checking") return <CheckingSkeleton />;

  return (
    <div className="flex h-screen flex-col bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">
      {pageHeader}

      {authState === "not-installed" && <NotInstalledView />}

      {authState === "unauthenticated" && (
        <GeminiLoginPanel
          loginState={loginState}
          loginOutput={loginOutput}
          loginUrls={loginUrls}
          configError={configError}
          onSaveApiKey={saveApiKey}
          onStartGca={startGcaLogin}
          onCancel={cancelLogin}
          onReset={resetLogin}
        />
      )}

      {authState === "authenticated" && <AuthenticatedView />}
    </div>
  );
}
