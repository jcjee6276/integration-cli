"use client";

import { useRef } from "react";

import type { CodexLoginState } from "../hooks/useCodexAuth";

const OPENAI_LOGO = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-gray-900/80 dark:text-white/80" aria-hidden="true">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

interface Props {
  loginState: CodexLoginState;
  configError: string;
  onSaveApiKey: (key: string) => void;
  onReset: () => void;
}

function SuccessView() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/[0.10]">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-500 dark:text-emerald-400">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">인증 완료</p>
    </div>
  );
}

export function CodexLoginPanel({ loginState, configError, onSaveApiKey, onReset }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = inputRef.current?.value.trim() ?? "";
    if (key) onSaveApiKey(key);
  };

  if (loginState === "done") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <SuccessView />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
          {OPENAI_LOGO}
        </div>
        <h2 className="text-xl font-semibold text-gray-900/90 dark:text-white/90">Codex CLI 인증</h2>
        <p className="max-w-sm text-sm text-gray-900/40 dark:text-white/40">
          OpenAI API 키를 입력해 주세요.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-900/50 dark:text-white/50">
            OpenAI API 키
          </label>
          <input
            ref={inputRef}
            type="password"
            placeholder="sk-..."
            autoFocus
            required
            className="rounded-lg border border-gray-900/[0.10] bg-gray-900/[0.03] px-3.5 py-2.5 font-mono text-sm text-gray-900/85 placeholder-gray-900/20 outline-none transition-colors focus:border-gray-900/30 focus:ring-2 focus:ring-gray-900/5 dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-white/85 dark:placeholder-white/20 dark:focus:border-white/30 dark:focus:ring-white/5"
          />
          <p className="text-[11px] text-gray-900/30 dark:text-white/30">
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900/55 underline-offset-2 hover:underline dark:text-white/55"
            >
              OpenAI 플랫폼
            </a>
            에서 API 키를 발급받을 수 있습니다.
          </p>
          {configError && (
            <p className="text-xs text-red-500 dark:text-red-400">{configError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loginState === "pending"}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {loginState === "pending" && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-gray-900/30 dark:border-t-gray-900" />
          )}
          {loginState === "pending" ? "저장 중…" : "저장"}
        </button>
      </form>
    </div>
  );
}
