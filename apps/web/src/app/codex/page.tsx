"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useCodexAuth } from "@/features/auth/hooks/useCodexAuth";
import { CodexLoginPanel } from "@/features/auth/ui/CodexLoginPanel";
import { ThemeToggle } from "@/lib/theme";

const OPENAI_LOGO = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-gray-900/80 dark:text-white/80" aria-hidden="true">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

function CheckingSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-[#faf8f5] dark:bg-[#07090e]">
      <div className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
        <div className="h-3.5 w-3.5 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
        <div className="h-[14px] w-20 rounded bg-gray-900/[0.07] dark:bg-white/[0.07]" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-gray-900/60 dark:border-white/[0.08] dark:border-t-white/60" />
        <span className="text-xs text-gray-900/20 dark:text-white/20">인증 확인 중…</span>
      </div>
    </div>
  );
}

function NotInstalledView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-gray-900/30 dark:text-white/30">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900/90 dark:text-white/90">Codex CLI가 설치되어 있지 않습니다</h2>
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

function AuthenticatedView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900/[0.03] blur-[120px] dark:bg-white/[0.03]" />
      </div>
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
        {OPENAI_LOGO}
      </div>
      <div className="relative text-center">
        <p className="font-semibold text-gray-900/75 dark:text-white/75">Codex CLI</p>
        <p className="mt-1 text-sm text-gray-900/30 dark:text-white/30">로그인되었습니다. 채팅 기능은 준비 중입니다.</p>
      </div>
    </div>
  );
}

export default function CodexPage() {
  const {
    authState,
    loginMethod,
    setLoginMethod,
    loginState,
    loginOutput,
    loginUrls,
    deviceCode,
    startDeviceLogin,
    cancelDeviceLogin,
    apiKeyLoginState,
    configError,
    saveApiKey,
    checkAuth,
  } = useCodexAuth();

  useEffect(() => {
    if (loginState === "done" || apiKeyLoginState === "done") void checkAuth();
  }, [loginState, apiKeyLoginState, checkAuth]);

  const pageHeader = (
    <header className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
      <Link href="/" className="text-gray-900/30 transition-colors hover:text-gray-900/60 dark:text-white/30 dark:hover:text-white/60">
        ←
      </Link>
      <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">Codex CLI</span>
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
        <CodexLoginPanel
          loginMethod={loginMethod}
          onMethodChange={setLoginMethod}
          loginState={loginState}
          loginOutput={loginOutput}
          loginUrls={loginUrls}
          deviceCode={deviceCode}
          onStartDeviceLogin={startDeviceLogin}
          onCancelDeviceLogin={cancelDeviceLogin}
          apiKeyLoginState={apiKeyLoginState}
          configError={configError}
          onSaveApiKey={saveApiKey}
        />
      )}
      {authState === "authenticated" && <AuthenticatedView />}
    </div>
  );
}
