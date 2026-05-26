"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchTask } from "../api/tasks.api";
import type { Task } from "../api/tasks.api";
import { TaskDetailView } from "../ui/TaskDetailView";

interface Props {
  taskId: string;
}

export function TaskDetailPageContainer({ taskId }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchTask(taskId)
      .then((nextTask) => { if (active) setTask(nextTask); })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [taskId]);

  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-8 dark:bg-[#07090e]">
      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-900/[0.08] text-gray-900/30 transition-colors hover:border-gray-900/[0.15] hover:text-gray-900/60 dark:border-white/[0.08] dark:text-white/30 dark:hover:border-white/[0.15] dark:hover:text-white/60"
            aria-label="홈으로 이동"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 010 1.06L7.06 8l2.72 2.72a.75.75 0 11-1.06 1.06L5.47 8.53a.75.75 0 010-1.06l3.25-3.25a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </Link>
          <div>
            <p className="text-sm font-semibold text-gray-900/80 dark:text-white/80">작업 상세보기</p>
            <p className="font-mono text-[11px] text-gray-900/30 dark:text-white/30">{taskId}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-900/[0.05] bg-white/50 dark:border-white/[0.05] dark:bg-white/[0.03]" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && task && <TaskDetailView task={task} />}
    </main>
  );
}
