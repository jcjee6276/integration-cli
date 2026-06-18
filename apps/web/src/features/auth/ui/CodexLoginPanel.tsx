"use client";

import { useRef } from "react";

import type { CodexLoginMethod, CodexLoginState } from "../hooks/useCodexAuth";

const OPENAI_LOGO = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-gray-900/80 dark:text-white/80" aria-hidden="true">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

// ─── Method Tab ───────────────────────────────────────────────────────────────

interface TabProps {
  method: CodexLoginMethod;
  selected: CodexLoginMethod;
  onSelect: (m: CodexLoginMethod) => void;
  label: string;
}

function MethodTab({ method, selected, onSelect, label }: TabProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(method)}
      className={[
        "flex-1 cursor-pointer rounded-lg px-4 py-2 text-xs font-medium transition-colors",
        selected === method
          ? "bg-gray-900/[0.07] text-gray-900/75 dark:bg-white/[0.07] dark:text-white/75"
          : "text-gray-900/35 hover:text-gray-900/60 dark:text-white/35 dark:hover:text-white/60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ─── Device Auth Panel ────────────────────────────────────────────────────────

interface DeviceAuthProps {
  loginState: CodexLoginState;
  loginOutput: string;
  loginUrls: string[];
  deviceCode: string | null;
  onStart: () => void;
  onCancel: () => void;
}

function DeviceAuthView({ loginState, loginOutput, loginUrls, deviceCode, onStart, onCancel }: DeviceAuthProps) {
  if (loginState === "idle") {
    return (
      <button
        onClick={onStart}
        className="cursor-pointer rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        ChatGPT로 로그인
      </button>
    );
  }

  if (loginState === "pending") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        {loginUrls.length > 0 ? (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-900/35 dark:text-white/35">
                1. 아래 링크를 브라우저에서 열어 로그인하세요
              </p>
              {loginUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-xs font-mono text-emerald-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  {url}
                </a>
              ))}
            </div>
            {deviceCode && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-gray-900/35 dark:text-white/35">
                  2. 이 일회용 코드를 입력하세요 <span className="text-gray-900/20 dark:text-white/20">(15분 내 유효)</span>
                </p>
                <div className="flex items-center justify-center rounded-xl border border-gray-900/[0.10] bg-gray-900/[0.03] py-4 dark:border-white/[0.10] dark:bg-white/[0.03]">
                  <span className="font-mono text-2xl font-bold tracking-widest text-gray-900/80 dark:text-white/80">
                    {deviceCode}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-900/30 dark:text-white/30">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-gray-900/60 dark:border-white/[0.08] dark:border-t-white/60" />
            연결 중…
          </div>
        )}

        {loginOutput && !loginUrls.length && (
          <pre className="max-h-40 overflow-y-auto rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.02] px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-900/45 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-white/45">
            {loginOutput}
          </pre>
        )}

        <button
          onClick={onCancel}
          className="cursor-pointer text-xs text-gray-900/25 transition-colors hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50"
        >
          취소
        </button>
      </div>
    );
  }

  if (loginState === "done") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/[0.10]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-500 dark:text-emerald-400">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">로그인 완료</p>
        <p className="text-xs text-gray-900/25 dark:text-white/25">잠시 후 자동으로 이동합니다…</p>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/[0.10]">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-500 dark:text-red-400">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="text-sm text-red-500 dark:text-red-400">로그인 중 문제가 발생했습니다.</p>
      {loginOutput && (
        <pre className="max-h-32 w-full max-w-sm overflow-y-auto rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.02] px-4 py-3 font-mono text-xs whitespace-pre-wrap text-gray-900/40 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-white/40">
          {loginOutput}
        </pre>
      )}
      <button
        onClick={onStart}
        className="cursor-pointer rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        다시 시도
      </button>
    </div>
  );
}

// ─── API Key Panel ────────────────────────────────────────────────────────────

interface ApiKeyProps {
  loginState: CodexLoginState;
  configError: string;
  onSave: (key: string) => void;
}

function ApiKeyView({ loginState, configError, onSave }: ApiKeyProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = inputRef.current?.value.trim() ?? "";
    if (key) onSave(key);
  };

  if (loginState === "done") {
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

  return (
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
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-default disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        {loginState === "pending" && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-gray-900/30 dark:border-t-gray-900" />
        )}
        {loginState === "pending" ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}

// ─── CodexLoginPanel ──────────────────────────────────────────────────────────

export type { CodexLoginMethod };

interface Props {
  loginMethod: CodexLoginMethod;
  onMethodChange: (m: CodexLoginMethod) => void;
  // device auth
  loginState: CodexLoginState;
  loginOutput: string;
  loginUrls: string[];
  deviceCode: string | null;
  onStartDeviceLogin: () => void;
  onCancelDeviceLogin: () => void;
  // api key
  apiKeyLoginState: CodexLoginState;
  configError: string;
  onSaveApiKey: (key: string) => void;
}

export function CodexLoginPanel({
  loginMethod,
  onMethodChange,
  loginState,
  loginOutput,
  loginUrls,
  deviceCode,
  onStartDeviceLogin,
  onCancelDeviceLogin,
  apiKeyLoginState,
  configError,
  onSaveApiKey,
}: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.04] dark:border-white/[0.08] dark:bg-white/[0.04]">
          {OPENAI_LOGO}
        </div>
        <h2 className="text-xl font-semibold text-gray-900/90 dark:text-white/90">Codex CLI 인증</h2>
        <p className="max-w-sm text-sm text-gray-900/40 dark:text-white/40">
          ChatGPT 계정으로 로그인하거나 API 키를 입력해 주세요.
        </p>
      </div>

      {/* Method tabs */}
      <div className="flex w-full max-w-sm rounded-xl border border-gray-900/[0.08] p-1 dark:border-white/[0.08]">
        <MethodTab method="device" selected={loginMethod} onSelect={onMethodChange} label="ChatGPT 로그인" />
        <MethodTab method="apikey" selected={loginMethod} onSelect={onMethodChange} label="API 키" />
      </div>

      {/* Content */}
      {loginMethod === "device" ? (
        <DeviceAuthView
          loginState={loginState}
          loginOutput={loginOutput}
          loginUrls={loginUrls}
          deviceCode={deviceCode}
          onStart={onStartDeviceLogin}
          onCancel={onCancelDeviceLogin}
        />
      ) : (
        <ApiKeyView
          loginState={apiKeyLoginState}
          configError={configError}
          onSave={onSaveApiKey}
        />
      )}
    </div>
  );
}
