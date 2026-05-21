"use client";

import { useCallback, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { WorkingDirPicker } from "@/components/ui/WorkingDirPicker";
import { AgentSelectModal } from "@/features/chat/ui/AgentSelectModal";
import type { AgentId } from "@/features/chat/ui/AgentSelectModal";
import type { Task } from "../api/tasks.api";
import { useTaskCreate } from "../hooks/useTaskCreate";
import { AgentRow } from "./AgentRoleSelect";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (task: Task) => void;
}

export function TaskCreateModal({ open, onClose, onCreated }: Props) {
  const {
    form,
    submitting,
    error,
    setTitle,
    setWorkingDir,
    addRequirement,
    updateRequirement,
    removeRequirement,
    addAgent,
    updateAgent,
    removeAgent,
    submit,
    reset,
  } = useTaskCreate(
    useCallback(
      (task: Task) => {
        onCreated?.(task);
        onClose();
      },
      [onCreated, onClose],
    ),
  );

  const [agentSelectOpen, setAgentSelectOpen] = useState(false);

  const handleAgentSelect = (agentId: AgentId) => {
    addAgent(agentId);
    setAgentSelectOpen(false);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <>
    <AgentSelectModal
      open={agentSelectOpen}
      onClose={() => setAgentSelectOpen(false)}
      onSelect={handleAgentSelect}
    />
    <Modal open={open} onClose={handleClose} title="새 작업 추가" maxWidth="max-w-xl">
      <div className="flex flex-col gap-5">

        {/* ── 작업 제목 ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-900/30 dark:text-white/30">
            작업 목표 <span className="text-orange-500">*</span>
          </label>
          <textarea
            rows={2}
            value={form.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 로그인 페이지 UI 구현 및 API 연동"
            className="w-full resize-none rounded-xl border border-gray-900/[0.08] bg-gray-900/[0.03] px-3 py-2.5 text-sm text-gray-900/80 placeholder-gray-900/20 outline-none transition-colors focus:border-orange-500/50 focus:bg-gray-900/[0.05] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/80 dark:placeholder-white/20 dark:focus:bg-white/[0.05]"
          />
        </section>

        {/* ── 워크 디렉토리 ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-gray-900/30 dark:text-white/30">
            워크 디렉토리 <span className="text-gray-900/20 normal-case tracking-normal dark:text-white/20">(선택)</span>
          </label>
          <WorkingDirPicker value={form.workingDir} onChange={setWorkingDir} />
        </section>

        {/* ── 요구사항 ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium uppercase tracking-wider text-gray-900/30 dark:text-white/30">
              요구사항
            </label>
            <button
              type="button"
              onClick={addRequirement}
              className="flex items-center gap-1 rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.03] px-2.5 py-1 text-xs text-gray-900/40 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.06] hover:text-gray-900/70 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-white/40 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.06] dark:hover:text-white/70"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z" />
              </svg>
              항목 추가
            </button>
          </div>

          {form.requirements.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-900/[0.07] py-5 dark:border-white/[0.07]">
              <p className="text-xs text-gray-900/20 dark:text-white/20">요구사항을 추가하세요</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {form.requirements.map((req, idx) => (
                <li key={req.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-gray-900/20 dark:text-white/20">{idx + 1}</span>
                  <input
                    type="text"
                    value={req.content}
                    onChange={(e) => updateRequirement(req.id, e.target.value)}
                    placeholder="요구사항 입력"
                    className="flex-1 rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.03] px-3 py-1.5 text-xs text-gray-900/70 placeholder-gray-900/20 outline-none transition-colors focus:border-gray-900/[0.15] focus:bg-gray-900/[0.05] dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-white/70 dark:placeholder-white/20 dark:focus:border-white/[0.15] dark:focus:bg-white/[0.05]"
                  />
                  <button
                    type="button"
                    onClick={() => removeRequirement(req.id)}
                    className="shrink-0 text-gray-900/20 transition-colors hover:text-red-500 dark:text-white/20 dark:hover:text-red-400"
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

        {/* ── 서브 에이전트 ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium uppercase tracking-wider text-gray-900/30 dark:text-white/30">
              서브 에이전트
            </label>
            <button
              type="button"
              onClick={() => setAgentSelectOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-gray-900/[0.07] bg-gray-900/[0.03] px-2.5 py-1 text-xs text-gray-900/40 transition-colors hover:border-gray-900/[0.14] hover:bg-gray-900/[0.06] hover:text-gray-900/70 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-white/40 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.06] dark:hover:text-white/70"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z" />
              </svg>
              에이전트 추가
            </button>
          </div>

          {form.agents.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-900/[0.07] py-5 dark:border-white/[0.07]">
              <p className="text-xs text-gray-900/20 dark:text-white/20">서브 에이전트를 추가하세요</p>
            </div>
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

        {/* ── 에러 ──────────────────────────────────────────────────── */}
        {error && (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2.5 text-xs text-red-500 dark:text-red-400">
            {error}
          </p>
        )}

        {/* ── 액션 ──────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 border-t border-gray-900/[0.06] pt-4 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-sm text-gray-900/35 transition-colors hover:bg-gray-900/[0.05] hover:text-gray-900/70 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/[0.05] dark:hover:text-white/70"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !form.title.trim()}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {submitting ? "생성 중…" : "작업 생성"}
          </button>
        </div>

      </div>
    </Modal>
    </>
  );
}
