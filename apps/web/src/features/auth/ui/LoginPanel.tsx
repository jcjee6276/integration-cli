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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20 text-3xl">
          🔐
        </div>
        <h2 className="text-xl font-semibold text-gray-100">Claude Code 로그인 필요</h2>
        <p className="max-w-sm text-sm text-gray-400">
          Claude CLI를 사용하려면 Anthropic 계정으로 로그인해야 합니다.
        </p>
      </div>

      {loginState === "idle" && (
        <button
          onClick={onStart}
          className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          Claude Code 로그인
        </button>
      )}

      {isPending && (
        <div className="flex w-full max-w-lg flex-col gap-4">
          {loginUrls.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-400">브라우저에서 아래 링크를 열어 인증을 완료하세요:</p>
              {loginUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all rounded-lg border border-orange-700/50 bg-orange-950/30 px-4 py-3 text-xs font-mono text-orange-300 transition-colors hover:border-orange-500 hover:text-orange-200"
                >
                  {url}
                </a>
              ))}
            </div>
          )}

          {loginOutput && (
            <pre className="max-h-48 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-400">
              {loginOutput}
            </pre>
          )}

          {loginUrls.length === 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-orange-500" />
              로그인 프로세스를 시작하는 중…
            </div>
          )}

          <button onClick={onCancel} className="text-xs text-gray-600 transition-colors hover:text-gray-400">
            취소
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-2xl">✅</div>
          <p className="text-sm font-medium text-green-400">로그인 완료</p>
          <p className="text-xs text-gray-500">잠시 후 자동으로 이동합니다…</p>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-2xl">⚠️</div>
          <p className="text-sm text-red-400">로그인 중 문제가 발생했습니다.</p>
          {loginOutput && (
            <pre className="max-h-32 w-full max-w-lg overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 font-mono text-xs whitespace-pre-wrap text-gray-500">
              {loginOutput}
            </pre>
          )}
          <button
            onClick={onStart}
            className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
