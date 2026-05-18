"use client";

import { Modal } from "@/components/ui/Modal";
import type { Task, TaskStatus } from "../api/tasks.api";
import { useTaskList } from "../hooks/useTaskList";
import { AgentRoleBadge } from "./AgentRoleSelect";
import { TaskEditModal } from "./TaskEditModal";

// ─── 상태 뱃지 ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string; dot?: string }
> = {
  pending:   { label: "대기",   className: "border-gray-700 text-gray-500",                             dot: "bg-gray-600" },
  running:   { label: "실행 중", className: "border-green-700/60 text-green-400 bg-green-900/20",        dot: "bg-green-400 animate-pulse" },
  stopped:   { label: "중지됨", className: "border-red-800/60 text-red-400 bg-red-900/20",              dot: "bg-red-400" },
  completed: { label: "완료",   className: "border-blue-700/60 text-blue-400 bg-blue-900/20",           dot: "bg-blue-400" },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.dot && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
      {cfg.label}
    </span>
  );
}

// ─── 카드 ─────────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isActioning: boolean;
  onExecute: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskCard({ task, isActioning, onExecute, onStop, onEdit, onDelete }: TaskCardProps) {
  const canExecute = task.status === "pending" || task.status === "stopped";
  const canStop    = task.status === "running";
  const loading    = isActioning;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-700/60 bg-gray-900/50 p-4 transition-colors hover:border-gray-600">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-sm font-semibold text-gray-100">{task.title}</h3>
          <p className="font-mono text-[10px] text-gray-600">{task.id.slice(0, 8)}…</p>
        </div>
        <StatusBadge status={task.status as TaskStatus} />
      </div>

      {/* 요구사항 미리보기 */}
      {task.requirements.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {[...task.requirements]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .slice(0, 3)
            .map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="text-gray-700">•</span>
                <span className="truncate">{r.content}</span>
              </li>
            ))}
          {task.requirements.length > 3 && (
            <li className="text-xs text-gray-600">+{task.requirements.length - 3}개 더</li>
          )}
        </ul>
      )}

      {/* 에이전트 뱃지 */}
      {task.agents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.agents.map((a) => (
            <AgentRoleBadge key={a.id} role={a.role} customRole={a.customRole} />
          ))}
        </div>
      )}

      {/* 하단 메타 + 액션 */}
      <div className="flex items-center justify-between border-t border-gray-800 pt-3">
        <span className="text-[10px] text-gray-600">
          {new Date(task.createdAt).toLocaleString("ko-KR", {
            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
          })}
        </span>

        <div className="flex items-center gap-1.5">
          {/* 실행 */}
          {canExecute && (
            <button
              onClick={onExecute}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg bg-green-700/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
            >
              {loading ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v7.78a1.5 1.5 0 002.3 1.269l5.773-3.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
              실행
            </button>
          )}

          {/* 중지 */}
          {canStop && (
            <button
              onClick={onStop}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg bg-red-700/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-40"
            >
              {loading ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M5.25 3A2.25 2.25 0 003 5.25v5.5A2.25 2.25 0 005.25 13h5.5A2.25 2.25 0 0013 10.75v-5.5A2.25 2.25 0 0010.75 3h-5.5z" />
                </svg>
              )}
              중지
            </button>
          )}

          {/* 수정 */}
          <button
            onClick={onEdit}
            disabled={loading || task.status === "running"}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            title={task.status === "running" ? "실행 중에는 수정할 수 없습니다" : "수정"}
          >
            수정
          </button>

          {/* 삭제 */}
          <button
            onClick={onDelete}
            disabled={loading || task.status === "running"}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={task.status === "running" ? "실행 중에는 삭제할 수 없습니다" : "삭제"}
          >
            삭제
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── TaskListModal ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TaskListModal({ open, onClose }: Props) {
  const {
    tasks,
    loading,
    actioningId,
    error,
    editingTask,
    setEditingTask,
    loadTasks,
    execute,
    stop,
    remove,
    onEditDone,
  } = useTaskList(open);

  // 편집 모달이 열려있으면 편집 모달만 렌더링
  if (editingTask) {
    return (
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={onEditDone}
      />
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="작업 목록" maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">

        {/* 툴바 */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {loading ? "불러오는 중…" : `총 ${tasks.length}개`}
          </p>
          <button
            onClick={() => void loadTasks()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}>
              <path
                fillRule="evenodd"
                d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37A5.995 5.995 0 008 4a6 6 0 100 12 6 6 0 005.812-4.5h1.539A7.5 7.5 0 118 2.5c1.373 0 2.663.372 3.772 1.021l.314-.814a.75.75 0 01.75-.23z"
                clipRule="evenodd"
              />
            </svg>
            새로고침
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* 로딩 */}
        {loading && tasks.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
            작업 목록을 불러오는 중…
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-xl">📋</div>
            <p className="text-sm text-gray-500">생성된 작업이 없습니다</p>
            <p className="text-xs text-gray-600">사이드바의 &ldquo;＋ 작업 추가&rdquo; 버튼으로 작업을 만들어보세요</p>
          </div>
        )}

        {/* 작업 카드 목록 */}
        {tasks.length > 0 && (
          <ul className="flex flex-col gap-3">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  isActioning={actioningId === task.id}
                  onExecute={() => void execute(task.id)}
                  onStop={() => void stop(task.id)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => void remove(task.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
