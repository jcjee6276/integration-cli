"use client";

import { Modal } from "@/components/ui/Modal";
import { WorkingDirPicker } from "@/components/ui/WorkingDirPicker";
import type { Task } from "../api/tasks.api";
import { useTaskEdit } from "../hooks/useTaskEdit";
import { AgentRow } from "./AgentRoleSelect";

interface Props {
  task: Task;
  onClose: () => void;
  onSaved: (updated: Task) => void;
}

export function TaskEditModal({ task, onClose, onSaved }: Props) {
  const {
    form, submitting, error,
    setTitle, setWorkingDir,
    addRequirement, updateRequirement, removeRequirement,
    addAgent, updateAgent, removeAgent,
    submit,
  } = useTaskEdit(task, (updated) => { onSaved(updated); onClose(); });

  return (
    <Modal open onClose={onClose} title="작업 수정" maxWidth="max-w-xl">
      <div className="flex flex-col gap-6">

        {/* 작업 목표 */}
        <section className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">작업 목표 *</label>
          <textarea
            rows={2}
            value={form.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 로그인 페이지 UI 구현 및 API 연동"
            className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-600 dark:focus:border-gray-500"
          />
        </section>

        {/* 워크 디렉토리 */}
        <section className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            워크 디렉토리 <span className="text-gray-400 dark:text-gray-600">(선택)</span>
          </label>
          <WorkingDirPicker value={form.workingDir} onChange={setWorkingDir} />
        </section>

        {/* 요구사항 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">요구사항</label>
            <button
              type="button"
              onClick={addRequirement}
              className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="text-base leading-none">+</span> 항목 추가
            </button>
          </div>
          {form.requirements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">
              요구사항을 추가하세요
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {form.requirements.map((req, idx) => (
                <li key={req.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-gray-400 dark:text-gray-600">{idx + 1}</span>
                  <input
                    type="text"
                    value={req.content}
                    onChange={(e) => updateRequirement(req.id, e.target.value)}
                    placeholder="요구사항 입력"
                    className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600 dark:focus:border-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeRequirement(req.id)}
                    className="shrink-0 text-gray-300 transition-colors hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 서브 에이전트 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">서브 에이전트</label>
            <button
              type="button"
              onClick={() => addAgent("frontend")}
              className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <span className="text-base leading-none">+</span> 에이전트 추가
            </button>
          </div>
          {form.agents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">
              서브 에이전트를 추가하세요
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {form.agents.map((agent) => (
                <li key={agent.id}>
                  <AgentRow
                    agent={agent}
                    onChange={(patch) => updateAgent(agent.id, patch)}
                    onRemove={() => removeAgent(agent.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 에러 */}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        {/* 액션 */}
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !form.title.trim()}
            className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
