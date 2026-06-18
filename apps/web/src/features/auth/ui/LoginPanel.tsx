"use client";

import type { LoginState } from "../hooks/useClaudeAuth";

interface LoginPanelProps {
  loginState: LoginState;
  loginOutput: string;
  loginUrls: string[];
  onStart: () => void;
  onCancel: () => void;
}

export function LoginPanel({ loginState, loginOutput, loginUrls, onStart, onCancel }: LoginPanelProps) {
  const isPending = loginState === "pending";
  const isDone = loginState === "done";
  const isError = loginState === "error";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-orange-500/[0.08] dark:border-white/[0.08]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-orange-500 dark:text-orange-400/80">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900/90 dark:text-white/90">Claude Code 로그인 필요</h2>
        <p className="max-w-sm text-sm text-gray-900/40 dark:text-white/40">
          Claude CLI를 사용하려면 Anthropic 계정으로 로그인해야 합니다.
        </p>
      </div>

      {loginState === "idle" && (
        <button
          onClick={onStart}
          className="cursor-pointer rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          Claude Code 로그인
        </button>
      )}

      {isPending && (
        <div className="flex w-full max-w-lg flex-col gap-4">
          {loginUrls.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-900/35 dark:text-white/35">브라우저에서 아래 링크를 열어 인증을 완료하세요:</p>
              {loginUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all rounded-lg border border-orange-700/50 bg-orange-950/30 px-4 py-3 text-xs font-mono text-orange-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:text-orange-300 dark:hover:text-orange-200"
                >
                  {url}
                </a>
              ))}
            </div>
          )}

          {loginOutput && (
            <pre className="max-h-48 overflow-y-auto rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.02] px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-900/45 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-white/45">
              {loginOutput}
            </pre>
          )}

          {loginUrls.length === 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-900/30 dark:text-white/30">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-orange-500 dark:border-white/[0.08]" />
              로그인 프로세스를 시작하는 중…
            </div>
          )}

          <button onClick={onCancel} className="cursor-pointer text-xs text-gray-900/25 transition-colors hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50">
            취소
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/[0.10]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-500 dark:text-emerald-400">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">로그인 완료</p>
          <p className="text-xs text-gray-900/25 dark:text-white/25">잠시 후 자동으로 이동합니다…</p>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/[0.10]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-500 dark:text-red-400">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-red-500 dark:text-red-400">로그인 중 문제가 발생했습니다.</p>
          {loginOutput && (
            <pre className="max-h-32 w-full max-w-lg overflow-y-auto rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.02] px-4 py-3 font-mono text-xs whitespace-pre-wrap text-gray-900/40 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-white/40">
              {loginOutput}
            </pre>
          )}
          <button
            onClick={onStart}
            className="cursor-pointer rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
