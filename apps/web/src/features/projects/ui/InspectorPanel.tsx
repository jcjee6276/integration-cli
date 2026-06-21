"use client";

import type { FormEvent } from "react";

import type { InspectorElement, InspectorState } from "../api/inspector.api";

import { CrawlAuditPanel } from "./CrawlAuditPanel";

interface InspectorPanelProps {
  appUrl: string;
  projectPath: string | null;
  state: InspectorState;
  error: string | null;
  lastElement: InspectorElement | null;
  onAppUrlChange: (url: string) => void;
  onStart: (url: string) => void;
  onStop: () => void;
  onClose: () => void;
}

function StatusDot({ state }: { state: InspectorState }) {
  const color =
    state === "active"
      ? "bg-emerald-500"
      : state === "connecting"
        ? "bg-amber-500 animate-pulse"
        : "bg-gray-900/25 dark:bg-white/25";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function getFileName(path?: string) {
  if (!path) return "";
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

export function InspectorPanel({
  appUrl,
  projectPath,
  state,
  error,
  lastElement,
  onAppUrlChange,
  onStart,
  onStop,
  onClose,
}: InspectorPanelProps) {
  const active = state === "active";
  const connecting = state === "connecting";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      if (active) onStop();
      else onStart(appUrl);
    } catch {}
  };

  return (
    <div className="shrink-0 border-b border-gray-900/[0.07] bg-gray-900/[0.015] px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.015]">
      <div className="flex items-center gap-2">
        <StatusDot state={state} />
        <span className="text-xs font-semibold text-gray-900/65 dark:text-white/65">
          Inspect Mode
        </span>
        <span className="text-[11px] text-gray-900/35 dark:text-white/35">
          {active
            ? "활성 — Chrome 창에서 요소 클릭 · 우하단 토글/Esc로 끄면 정상 동작"
            : connecting
              ? "연결 중..."
              : "대기"}
        </span>
        <button
          type="button"
          onClick={onClose}
          title="닫기"
          className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.06] hover:text-gray-900/70 dark:text-white/30 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={appUrl}
          onChange={(event) => onAppUrlChange(event.target.value)}
          disabled={active || connecting}
          placeholder="http://localhost:3000"
          className="h-9 min-w-0 flex-1 rounded-lg border border-gray-900/[0.09] bg-white px-3 font-mono text-xs text-gray-900/75 transition-colors outline-none focus:border-emerald-500/50 disabled:opacity-50 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-white/75"
        />
        <button
          type="submit"
          disabled={connecting || (!active && !appUrl.trim())}
          className={[
            "flex h-9 min-w-20 cursor-pointer items-center justify-center rounded-lg px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
            active
              ? "bg-red-500/90 text-white hover:bg-red-600"
              : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:hover:text-gray-950",
          ].join(" ")}
        >
          {active ? "중지" : connecting ? "연결 중" : "연결"}
        </button>
      </form>

      {error && <p className="mt-2 text-[11px] text-red-600 dark:text-red-300">{error}</p>}

      {lastElement && (
        <div className="mt-2 rounded-lg border border-gray-900/[0.07] bg-white/60 px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.02]">
          {lastElement.notFound ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-300">
              소스를 찾을 수 없음
              {lastElement.tagName ? ` — <${lastElement.tagName}>` : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {lastElement.componentName && (
                <span className="text-xs font-semibold text-gray-900/70 dark:text-white/70">
                  {lastElement.componentName}
                </span>
              )}
              <span className="truncate font-mono text-[11px] text-gray-900/45 dark:text-white/45">
                {getFileName(lastElement.fileName)}
                {lastElement.line ? `:${lastElement.line}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      <CrawlAuditPanel appUrl={appUrl} projectPath={projectPath} />
    </div>
  );
}
