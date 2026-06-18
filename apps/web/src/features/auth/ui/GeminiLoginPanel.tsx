"use client";

import { useRef, useState } from "react";

import type { GeminiAuthMethod, GeminiLoginState } from "../hooks/useGeminiAuth";

interface GeminiLoginPanelProps {
  loginState: GeminiLoginState;
  loginOutput: string;
  loginUrls: string[];
  configError: string;
  onSaveApiKey: (key: string) => void;
  onStartGca: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const GOOGLE_LOGO = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// ─── Method Select ────────────────────────────────────────────────────────────

interface MethodSelectProps {
  onSelect: (method: GeminiAuthMethod) => void;
}

function MethodSelect({ onSelect }: MethodSelectProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <button
        onClick={() => onSelect("api-key")}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.02] px-5 py-4 text-left transition-all hover:border-blue-500/40 hover:bg-blue-500/[0.04] dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-blue-400/40 dark:hover:bg-blue-400/[0.04]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/[0.10]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5 text-blue-500 dark:text-blue-400">
            <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900/85 dark:text-white/85">API 키</p>
          <p className="text-xs text-gray-900/35 dark:text-white/35">Google AI Studio에서 발급한 키 입력</p>
        </div>
      </button>

      <button
        onClick={() => onSelect("gca")}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.02] px-5 py-4 text-left transition-all hover:border-blue-500/40 hover:bg-blue-500/[0.04] dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-blue-400/40 dark:hover:bg-blue-400/[0.04]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/[0.10]">
          {GOOGLE_LOGO}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900/85 dark:text-white/85">Google Cloud (GCA)</p>
          <p className="text-xs text-gray-900/35 dark:text-white/35">gcloud CLI로 Application Default Credentials 설정</p>
        </div>
      </button>
    </div>
  );
}

// ─── API Key Form ─────────────────────────────────────────────────────────────

interface ApiKeyFormProps {
  loginState: GeminiLoginState;
  configError: string;
  onSubmit: (key: string) => void;
  onBack: () => void;
}

function ApiKeyForm({ loginState, configError, onSubmit, onBack }: ApiKeyFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = inputRef.current?.value.trim() ?? "";
    if (key) onSubmit(key);
  };

  if (loginState === "done") return <SuccessView />;

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-900/50 dark:text-white/50">
          Gemini API 키
        </label>
        <input
          ref={inputRef}
          type="password"
          placeholder="AIza..."
          autoFocus
          required
          className="rounded-lg border border-gray-900/[0.10] bg-gray-900/[0.03] px-3.5 py-2.5 font-mono text-sm text-gray-900/85 placeholder-gray-900/20 outline-none transition-colors focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-white/85 dark:placeholder-white/20 dark:focus:border-blue-400/50 dark:focus:ring-blue-400/10"
        />
        <p className="text-[11px] text-gray-900/30 dark:text-white/30">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline dark:text-blue-400"
          >
            Google AI Studio
          </a>
          에서 API 키를 발급받을 수 있습니다.
        </p>
        {configError && (
          <p className="text-xs text-red-500 dark:text-red-400">{configError}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={loginState === "pending"}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-default disabled:opacity-50"
        >
          {loginState === "pending" && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {loginState === "pending" ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-xs text-gray-900/25 transition-colors hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50"
        >
          ← 뒤로
        </button>
      </div>
    </form>
  );
}

// ─── GCA Form ─────────────────────────────────────────────────────────────────

interface GcaFormProps {
  loginState: GeminiLoginState;
  loginOutput: string;
  loginUrls: string[];
  onStart: () => void;
  onCancel: () => void;
  onBack: () => void;
}

function GcaForm({ loginState, loginOutput, loginUrls, onStart, onCancel, onBack }: GcaFormProps) {
  if (loginState === "done") return <SuccessView />;

  const isPending = loginState === "pending";

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      {loginState === "idle" || loginState === "error" ? (
        <>
          <div className="flex flex-col gap-2 rounded-xl border border-gray-900/[0.07] bg-gray-900/[0.025] p-4 dark:border-white/[0.07] dark:bg-white/[0.025]">
            <p className="text-sm font-medium text-gray-900/70 dark:text-white/70">
              gcloud CLI가 필요합니다
            </p>
            <p className="text-xs text-gray-900/40 dark:text-white/40">
              먼저{" "}
              <a
                href="https://cloud.google.com/sdk/docs/install"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline dark:text-blue-400"
              >
                Google Cloud SDK
              </a>
              를 설치한 후 아래 버튼을 클릭하세요.
            </p>
            <code className="mt-1 rounded-md bg-gray-900/[0.04] px-2.5 py-1.5 font-mono text-xs text-gray-900/50 dark:bg-white/[0.04] dark:text-white/50">
              gcloud auth application-default login
            </code>
          </div>

          {loginState === "error" && loginOutput && (
            <pre className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs whitespace-pre-wrap text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              {loginOutput}
            </pre>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={onStart}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {GOOGLE_LOGO}
              Google 계정으로 로그인
            </button>
            <button
              onClick={onBack}
              className="cursor-pointer text-xs text-gray-900/25 transition-colors hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50"
            >
              ← 뒤로
            </button>
          </div>
        </>
      ) : null}

      {isPending && (
        <>
          {loginUrls.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-900/35 dark:text-white/35">브라우저에서 아래 링크를 열어 인증을 완료하세요:</p>
              {loginUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all rounded-lg border border-blue-700/50 bg-blue-950/30 px-4 py-3 text-xs font-mono text-blue-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200"
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
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/[0.08] border-t-blue-500 dark:border-white/[0.08]" />
              gcloud 인증 진행 중…
            </div>
          )}
          <button onClick={onCancel} className="text-xs text-gray-900/25 transition-colors hover:text-gray-900/50 dark:text-white/25 dark:hover:text-white/50">
            취소
          </button>
        </>
      )}
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

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

// ─── Panel Root ───────────────────────────────────────────────────────────────

export function GeminiLoginPanel({
  loginState,
  loginOutput,
  loginUrls,
  configError,
  onSaveApiKey,
  onStartGca,
  onCancel,
  onReset,
}: GeminiLoginPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<GeminiAuthMethod | null>(null);

  const handleBack = () => {
    onReset();
    setSelectedMethod(null);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-900/[0.08] bg-blue-500/[0.08] dark:border-white/[0.08]">
          {GOOGLE_LOGO}
        </div>
        <h2 className="text-xl font-semibold text-gray-900/90 dark:text-white/90">Gemini CLI 인증</h2>
        {!selectedMethod && (
          <p className="max-w-sm text-sm text-gray-900/40 dark:text-white/40">
            사용할 인증 방식을 선택해 주세요.
          </p>
        )}
      </div>

      {/* Content */}
      {!selectedMethod && <MethodSelect onSelect={setSelectedMethod} />}

      {selectedMethod === "api-key" && (
        <ApiKeyForm
          loginState={loginState}
          configError={configError}
          onSubmit={onSaveApiKey}
          onBack={handleBack}
        />
      )}

      {selectedMethod === "gca" && (
        <GcaForm
          loginState={loginState}
          loginOutput={loginOutput}
          loginUrls={loginUrls}
          onStart={onStartGca}
          onCancel={onCancel}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
