"use client";

import { useCallback, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { Task, TaskStatus } from "../api/tasks.api";
import { useTaskExecution } from "../hooks/useTaskExecution";
import { useTaskList } from "../hooks/useTaskList";
import { AgentRoleBadge } from "./AgentRoleSelect";
import { AgentOutputPanel } from "./AgentOutputPanel";
import { TaskEditModal } from "./TaskEditModal";

// ─── 상태 뱃지 ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string; dot?: string }
> = {
  pending:   { label: "대기",    className: "border-gray-700 text-gray-500",                          dot: "bg-gray-600" },
  running:   { label: "실행 중",  className: "border-green-700/60 text-green-400 bg-green-900/20",     dot: "bg-green-400 animate-pulse" },
  stopped:   { label: "중지됨",  className: "border-red-800/60 text-red-400 bg-red-900/20",           dot: "bg-red-400" },
  completed: { label: "완료",    className: "border-blue-700/60 text-blue-400 bg-blue-900/20",        dot: "bg-blue-400" },
  error:     { label: "오류",    className: "border-red-700/60 text-red-400 bg-red-900/20",           dot: "bg-red-500" },
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

// ─── TaskCard ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isActioning: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onExecute: () => void;
  onStop: () => void;
  onEdit: () => void;
  onRerun: (note: string) => void;
  onDelete: () => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
}

function TaskCard({
  task,
  isActioning,
  expanded,
  onToggleExpand,
  onExecute,
  onStop,
  onEdit,
  onRerun,
  onDelete,
  onTaskStatusChange,
}: TaskCardProps) {
  const isRunning     = task.status === "running";
  const isFinished    = task.status === "completed" || task.status === "error";
  const canExecute    = task.status === "pending" || task.status === "stopped";
  const canStop       = isRunning;
  const canRerun      = isFinished;
  const showLogs      = expanded && (isRunning || isFinished);

  const [rerunMode, setRerunMode] = useState(false);
  const [supplementNote, setSupplementNote] = useState("");

  const handleRerunConfirm = () => {
    onRerun(supplementNote);
    setRerunMode(false);
    setSupplementNote("");
  };

  const handleRerunCancel = () => {
    setRerunMode(false);
    setSupplementNote("");
  };

  const { agentLogs, connected } = useTaskExecution(
    showLogs ? task.id : null,
    onTaskStatusChange,
  );

  return (
    <article className="flex flex-col rounded-xl border border-gray-700/60 bg-gray-900/50 transition-colors hover:border-gray-600">
      {/* 카드 헤더 */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-start justify-between gap-3 rounded-xl p-4 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-100">{task.title}</h3>
            {task.agents.length > 0 && (
              <span className="shrink-0 rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
                에이전트 {task.agents.length}
              </span>
            )}
          </div>
          <p className="font-mono text-[10px] text-gray-600">{task.id.slice(0, 8)}…</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={task.status as TaskStatus} />
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-3.5 w-3.5 shrink-0 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* 확장 영역 */}
      {expanded && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {/* 요구사항 */}
          {task.requirements.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {[...task.requirements]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((r) => (
                  <li key={r.id} className="flex items-start gap-1.5 text-xs text-gray-500">
                    <span className="mt-0.5 text-gray-700">•</span>
                    <span>{r.content}</span>
                  </li>
                ))}
            </ul>
          )}

          {/* 에이전트 역할 */}
          {task.agents.length > 0 && !showLogs && (
            <div className="flex flex-wrap gap-1.5">
              {task.agents.map((a) => (
                <AgentRoleBadge key={a.id} role={a.role} customRole={a.customRole} />
              ))}
            </div>
          )}

          {/* 실시간 에이전트 출력 */}
          {showLogs && (
            <AgentOutputPanel
              agents={task.agents}
              agentLogs={agentLogs}
              connected={connected}
            />
          )}

          {/* 재 실행 보완 입력 패널 */}
          {rerunMode && (
            <div className="flex flex-col gap-2 rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
              <label className="text-xs font-medium text-blue-300">
                보완할 점 입력
                <span className="ml-1 text-[10px] font-normal text-gray-500">(선택 — 비워두면 동일 조건으로 재 실행)</span>
              </label>
              <textarea
                rows={3}
                value={supplementNote}
                onChange={(e) => setSupplementNote(e.target.value)}
                placeholder="예: 에러 핸들링이 빠져 있습니다. 로딩 상태도 추가해주세요."
                autoFocus
                className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-700"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRerunCancel}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleRerunConfirm}
                  disabled={isActioning}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-40"
                >
                  {isActioning ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37A5.995 5.995 0 008 4a6 6 0 100 12 6 6 0 005.812-4.5h1.539A7.5 7.5 0 118 2.5c1.373 0 2.663.372 3.772 1.021l.314-.814a.75.75 0 01.75-.23z" clipRule="evenodd" />
                    </svg>
                  )}
                  재 실행
                </button>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-3">
            <span className="text-[10px] text-gray-600">
              {new Date(task.createdAt).toLocaleString("ko-KR", {
                month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            <div className="flex items-center gap-1.5">
              {/* 실행 (pending/stopped) */}
              {canExecute && (
                <button
                  onClick={onExecute}
                  disabled={isActioning}
                  className="flex items-center gap-1 rounded-lg bg-green-700/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
                >
                  {isActioning ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v7.78a1.5 1.5 0 002.3 1.269l5.773-3.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  )}
                  실행
                </button>
              )}

              {/* 중지 (running) */}
              {canStop && (
                <button
                  onClick={onStop}
                  disabled={isActioning}
                  className="flex items-center gap-1 rounded-lg bg-red-700/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-40"
                >
                  {isActioning ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path d="M5.25 3A2.25 2.25 0 003 5.25v5.5A2.25 2.25 0 005.25 13h5.5A2.25 2.25 0 0013 10.75v-5.5A2.25 2.25 0 0010.75 3h-5.5z" />
                    </svg>
                  )}
                  중지
                </button>
              )}

              {/* 재 실행 (completed/error) */}
              {canRerun && !rerunMode && (
                <button
                  onClick={() => setRerunMode(true)}
                  disabled={isActioning}
                  className="flex items-center gap-1 rounded-lg border border-blue-700/60 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:border-blue-500 hover:bg-blue-900/20 hover:text-blue-200 disabled:opacity-40"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37A5.995 5.995 0 008 4a6 6 0 100 12 6 6 0 005.812-4.5h1.539A7.5 7.5 0 118 2.5c1.373 0 2.663.372 3.772 1.021l.314-.814a.75.75 0 01.75-.23z" clipRule="evenodd" />
                  </svg>
                  재 실행
                </button>
              )}

              {/* 수정 (pending/stopped만 — 완료된 작업은 재 실행으로 보완) */}
              {!isFinished && (
                <button
                  onClick={onEdit}
                  disabled={isActioning || isRunning}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  title={isRunning ? "실행 중에는 수정할 수 없습니다" : "수정"}
                >
                  수정
                </button>
              )}

              {/* 삭제 */}
              <button
                onClick={onDelete}
                disabled={isActioning || isRunning}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                title={isRunning ? "실행 중에는 삭제할 수 없습니다" : "삭제"}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
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
    rerun,
    remove,
    onEditDone,
    updateTaskStatus,
  } = useTaskList(open);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((taskId: string) => {
    setExpandedId((prev) => (prev === taskId ? null : taskId));
  }, []);

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
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37A5.995 5.995 0 008 4a6 6 0 100 12 6 6 0 005.812-4.5h1.539A7.5 7.5 0 118 2.5c1.373 0 2.663.372 3.772 1.021l.314-.814a.75.75 0 01.75-.23z" clipRule="evenodd" />
            </svg>
            새로고침
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {loading && tasks.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
            작업 목록을 불러오는 중…
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-xl">📋</div>
            <p className="text-sm text-gray-500">생성된 작업이 없습니다</p>
            <p className="text-xs text-gray-600">
              사이드바의 &ldquo;＋ 작업 추가&rdquo; 버튼으로 작업을 만들어보세요
            </p>
          </div>
        )}

        {tasks.length > 0 && (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  isActioning={actioningId === task.id}
                  expanded={expandedId === task.id}
                  onToggleExpand={() => handleToggleExpand(task.id)}
                  onExecute={() => {
                    void execute(task.id);
                    setExpandedId(task.id);
                  }}
                  onStop={() => void stop(task.id)}
                  onEdit={() => setEditingTask(task)}
                  onRerun={(note) => {
                    void rerun(task.id, note || undefined);
                    setExpandedId(task.id);
                  }}
                  onDelete={() => void remove(task.id)}
                  onTaskStatusChange={updateTaskStatus}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
