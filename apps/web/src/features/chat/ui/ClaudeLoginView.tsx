"use client";

import Link from "next/link";

import type { LoginState } from "@/features/auth/hooks/useClaudeAuth";
import { LoginPanel } from "@/features/auth/ui/LoginPanel";
import { ThemeToggle } from "@/lib/theme";

interface ClaudeLoginViewProps {
  loginState: LoginState;
  loginOutput: string;
  loginUrls: string[];
  onStart: () => void;
  onCancel: () => void;
}

export function ClaudeLoginView({
  loginState,
  loginOutput,
  loginUrls,
  onStart,
  onCancel,
}: ClaudeLoginViewProps) {
  return (
    <div className="flex h-screen flex-col bg-[#faf8f5] text-gray-900 dark:bg-[#07090e] dark:text-white">
      <header className="flex items-center gap-2 border-b border-gray-900/[0.07] px-4 py-3 dark:border-white/[0.07]">
        <Link href="/" className="text-gray-900/30 transition-colors hover:text-gray-900/60 dark:text-white/30 dark:hover:text-white/60">
          ←
        </Link>
        <span className="text-sm font-semibold text-gray-900/80 dark:text-white/80">JI CLI</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <LoginPanel
        loginState={loginState}
        loginOutput={loginOutput}
        loginUrls={loginUrls}
        onStart={onStart}
        onCancel={onCancel}
      />
    </div>
  );
}
