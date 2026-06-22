"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useArchivedTasks } from "@/features/tasks/hooks/useArchivedTasks";
import { useIntentionalOverRenderTest } from "@/hooks/useIntentionalOverRenderTest";

type PanelTab = "archive" | "project";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  running: "실행 중",
  stopped: "중지됨",
  completed: "완료",
  error: "오류",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-gray-900/40 bg-gray-900/[0.05] dark:text-white/40 dark:bg-white/[0.05]",
  running: "text-blue-600 bg-blue-500/[0.08] dark:text-blue-400 dark:bg-blue-400/[0.12]",
  stopped: "text-amber-600 bg-amber-500/[0.08] dark:text-amber-400 dark:bg-amber-400/[0.12]",
  completed:
    "text-emerald-600 bg-emerald-500/[0.08] dark:text-emerald-400 dark:bg-emerald-400/[0.12]",
  error: "text-red-600 bg-red-500/[0.08] dark:text-red-400 dark:bg-red-400/[0.12]",
};

// ─── Archive Tab ──────────────────────────────────────────────────────────────

function ArchiveTab() {
  const { tasks, loading, actioningTask, error, restoreTask, removeTask } = useArchivedTasks();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-900/30 dark:text-white/30">
        <span className="h-3 w-3 animate-spin rounded-full border border-gray-900/[0.12] border-t-gray-900/40 dark:border-white/[0.12] dark:border-t-white/40" />
        불러오는 중…
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-6 w-6 text-gray-900/15 dark:text-white/15"
        >
          <path d="M.75 3a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H.75zM2 7.25A.75.75 0 012.75 6.5h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 7.25zm1.75 3a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z" />
        </svg>
        <p className="text-xs text-gray-900/25 dark:text-white/25">보관된 작업이 없습니다</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}
      <ul className="flex flex-col divide-y divide-gray-900/[0.05] dark:divide-white/[0.05]">
        {tasks.map((task) => {
          const restoring = actioningTask?.id === task.id && actioningTask.action === "restore";
          const deleting = actioningTask?.id === task.id && actioningTask.action === "delete";
          const acting = restoring || deleting;
          return (
            <li key={task.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-900/70 dark:text-white/70">
                  {task.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[task.status] ?? STATUS_COLOR.pending}`}
                  >
                    {STATUS_LABEL[task.status] ?? task.status}
                  </span>
                  <span className="text-[10px] text-gray-900/20 dark:text-white/20">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void restoreTask(task.id)}
                  title="보관 해제"
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-900/30 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/30 dark:hover:bg-white/[0.05] dark:hover:text-white/70"
                >
                  {restoring ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-900/[0.12] border-t-gray-900/40 dark:border-white/[0.12] dark:border-t-white/40" />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M8.75 1.75a.75.75 0 00-1.5 0v5.19L5.03 4.72a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l3.5-3.5a.75.75 0 00-1.06-1.06L8.75 6.94V1.75zM1.5 9.25a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0112.75 13.5h-9.5A1.75 1.75 0 011.5 11.75v-2.5z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void removeTask(task.id)}
                  title="삭제"
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-900/25 transition-colors hover:bg-red-500/[0.06] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/25 dark:hover:bg-red-400/[0.08] dark:hover:text-red-400"
                >
                  {deleting ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-900/[0.12] border-t-gray-900/40 dark:border-white/[0.12] dark:border-t-white/40" />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 111.492.149l-.66 6.6A1.748 1.748 0 0110.595 15h-5.19a1.748 1.748 0 01-1.741-1.575l-.66-6.6a.75.75 0 111.492-.15zM6.5 1.75V3h3V1.75a.25.25 0 00-.25-.25h-2.5a.25.25 0 00-.25.25z" />
                    </svg>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── FloatingActionPanel ──────────────────────────────────────────────────────

export function FloatingActionPanel() {
  // INTENTIONAL_OVER_RENDER_TEST: 과다 렌더링 탐지 검증용.
  useIntentionalOverRenderTest("FloatingActionPanel", { intervalMs: 850, maxTicks: 18 });

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("archive");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={panelRef} className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 overflow-hidden rounded-2xl border border-gray-900/[0.08] bg-white shadow-[0_16px_48px_-8px_rgba(0,0,0,0.18)] dark:border-white/[0.08] dark:bg-[#0e1117] dark:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]">
          {/* 탭 헤더 */}
          <div className="flex items-center border-b border-gray-900/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
            <div className="flex items-center gap-1 rounded-lg border border-gray-900/[0.06] bg-gray-900/[0.03] p-0.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
              {(
                [
                  { id: "archive" as PanelTab, label: "작업 보관함" },
                  { id: "project" as PanelTab, label: "프로젝트" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id === "project") {
                      router.push("/projects");
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  className={[
                    "h-7 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-white text-gray-900/80 shadow-sm dark:bg-white/[0.10] dark:text-white/85"
                      : "text-gray-900/35 hover:text-gray-900/65 dark:text-white/35 dark:hover:text-white/65",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="max-h-80 overflow-y-auto">
            <ArchiveTab />
          </div>
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all",
          "dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]",
          open
            ? "bg-gray-900/80 text-white dark:bg-white/80 dark:text-gray-900"
            : "bg-white text-gray-900/60 hover:bg-gray-50 hover:text-gray-900/85 dark:bg-[#1a1f2e] dark:text-white/60 dark:hover:bg-[#1f2535] dark:hover:text-white/85",
        ].join(" ")}
        aria-label="작업 보관함 / 프로젝트"
      >
        {open ? (
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8.5 0A1.5 1.5 0 0111 1h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zM1 11a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 017 11v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 011 14v-3zm8.5 0A1.5 1.5 0 0111 9.5h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 14v-3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
