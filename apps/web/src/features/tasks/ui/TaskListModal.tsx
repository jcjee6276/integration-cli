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
  pending:   { label: "대기",    className: "border-white/[0.1] text-white/35",                                    dot: "bg-white/25" },
  running:   { label: "실행 중",  className: "border-emerald-500/40 text-emerald-400 bg-emerald-500/[0.08]",        dot: "bg-emerald-400 animate-pulse" },
  stopped:   { label: "중지됨",  className: "border-red-500/40 text-red-400 bg-red-500/[0.08]",                    dot: "bg-red-400" },
  completed: { label: "완료",    className: "border-blue-500/40 text-blue-400 bg-blue-500/[0.08]",                 dot: "bg-blue-400" },
  error:     { label: "오류",    className: "border-red-500/40 text-red-400 bg-red-500/[0.08]",                    dot: "bg-red-500" },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.className}`}>
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
  const isRunning  = task.status === "running";
  const isFinished = task.status === "completed" || task.status === "error";
  const canExecute = task.status === "pending" || task.status === "stopped";
  const canStop    = isRunning;
  const canRerun   = isFinished;
  const showLogs   = expanded && (isRunning || isFinished);

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
    <article className={[
      "flex flex-col rounded-xl border transition-colors",
      isRunning
        ? "border-emerald-500/20 bg-emerald-500/[0.03]"
        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.11]",
    ].join(" ")}>
      {/* 카드 헤더 */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-start justify-between gap-3 rounded-xl p-4 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-white/80">{task.title}</h3>
            {task.agents.length > 0 && (
              <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/30">
                에이전트 {task.agents.length}
              </span>
            )}
          </div>
          <p className="font-mono text-[10px] text-white/20">{task.id.slice(0, 8)}…</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={task.status as TaskStatus} />
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`h-3.5 w-3.5 shrink-0 text-white/20 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* 확장 영역 — grid-rows 트랜지션으로 height fade + opacity fade */}
      <div
        className={[
          "grid transition-all duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 px-4 pb-4">
            {/* 요구사항 */}
            {task.requirements.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {[...task.requirements]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((r) => (
                    <li key={r.id} className="flex items-start gap-1.5 text-xs text-white/35">
                      <span className="mt-0.5 text-white/15">•</span>
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
              <div className="flex flex-col gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-3">
                <label className="text-xs font-medium text-blue-400/80">
                  보완할 점 입력
                  <span className="ml-1 text-[10px] font-normal text-white/25">(선택 — 비워두면 동일 조건으로 재 실행)</span>
                </label>
                <textarea
                  rows={3}
                  value={supplementNote}
                  onChange={(e) => setSupplementNote(e.target.value)}
                  placeholder="예: 에러 핸들링이 빠져 있습니다. 로딩 상태도 추가해주세요."
                  autoFocus
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/70 placeholder-white/20 outline-none focus:border-blue-500/50"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleRerunCancel}
                    className="rounded-lg px-3 py-1.5 text-xs text-white/35 transition-colors hover:text-white/70"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleRerunConfirm}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                  >
                    {isActioning ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
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
            <div className="flex items-center justify-between border-t border-white/[0.05] pt-3">
              <span className="text-[10px] text-white/20">
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
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
                  >
                    {isActioning ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
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
                    className="flex items-center gap-1.5 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                  >
                    {isActioning ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
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
                    className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:border-blue-400/50 hover:bg-blue-500/[0.08] hover:text-blue-300 disabled:opacity-40"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37A5.995 5.995 0 008 4a6 6 0 100 12 6 6 0 005.812-4.5h1.539A7.5 7.5 0 118 2.5c1.373 0 2.663.372 3.772 1.021l.314-.814a.75.75 0 01.75-.23z" clipRule="evenodd" />
                    </svg>
                    재 실행
                  </button>
                )}

                {/* 수정 */}
                {!isFinished && (
                  <button
                    onClick={onEdit}
                    disabled={isActioning || isRunning}
                    className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:border-white/[0.15] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-30"
                    title={isRunning ? "실행 중에는 수정할 수 없습니다" : "수정"}
                  >
                    수정
                  </button>
                )}

                {/* 삭제 */}
                <button
                  onClick={onDelete}
                  disabled={isActioning || isRunning}
                  className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/25 transition-colors hover:border-red-500/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                  title={isRunning ? "실행 중에는 삭제할 수 없습니다" : "삭제"}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
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
          <p className="text-xs text-white/25">
            {loading ? "불러오는 중…" : `총 ${tasks.length}개`}
          </p>
          <button
            onClick={() => void loadTasks()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-xs text-white/35 transition-colors hover:border-white/[0.13] hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}>
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37A5.995 5.995 0 008 4a6 6 0 100 12 6 6 0 005.812-4.5h1.539A7.5 7.5 0 118 2.5c1.373 0 2.663.372 3.772 1.021l.314-.814a.75.75 0 01.75-.23z" clipRule="evenodd" />
            </svg>
            새로고침
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2.5 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* 로딩 스켈레톤 */}
        {loading && tasks.length === 0 && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-white/20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-white/35">생성된 작업이 없습니다</p>
              <p className="mt-1 text-xs text-white/20">
                사이드바의 &ldquo;＋ 작업 추가&rdquo; 버튼으로 작업을 만들어보세요
              </p>
            </div>
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
