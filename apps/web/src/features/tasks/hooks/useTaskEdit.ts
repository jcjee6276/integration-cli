"use client";

import { useCallback, useEffect, useState } from "react";

import { updateTask } from "../api/tasks.api";
import type { AgentRole, Task, UpdateTaskPayload } from "../api/tasks.api";
import type { AgentDraft, RequirementDraft } from "./useTaskCreate";
import type { AgentId } from "@/features/chat/ui/AgentSelectModal";

let draftId = 1000; // useTaskCreate와 충돌 방지
const nextDraftId = () => String(++draftId);

export interface EditFormState {
  title: string;
  workingDir: string;
  requirements: RequirementDraft[];
  agents: AgentDraft[];
}

function toRequirementDrafts(reqs: Task["requirements"]): RequirementDraft[] {
  return [...reqs]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((r) => ({ id: nextDraftId(), content: r.content }));
}

function toAgentDrafts(agents: Task["agents"]): AgentDraft[] {
  return agents.map((a) => ({
    id: nextDraftId(),
    agentType: a.agentType as AgentId,
    role: a.role,
    customRole: a.customRole ?? "",
  }));
}

export function useTaskEdit(task: Task, onSuccess?: (updated: Task) => void) {
  const [form, setForm] = useState<EditFormState>(() => ({
    title: task.title,
    workingDir: task.workingDir ?? "",
    requirements: toRequirementDrafts(task.requirements),
    agents: toAgentDrafts(task.agents),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // task prop이 바뀌면 폼 동기화
  useEffect(() => {
    setForm({
      title: task.title,
      workingDir: task.workingDir ?? "",
      requirements: toRequirementDrafts(task.requirements),
      agents: toAgentDrafts(task.agents),
    });
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── title / workingDir ──────────────────────────────────────────────

  const setTitle = useCallback((v: string) => setForm((f) => ({ ...f, title: v })), []);
  const setWorkingDir = useCallback((v: string) => setForm((f) => ({ ...f, workingDir: v })), []);

  // ─── requirements ────────────────────────────────────────────────────

  const addRequirement = useCallback(() => {
    setForm((f) => ({ ...f, requirements: [...f.requirements, { id: nextDraftId(), content: "" }] }));
  }, []);

  const updateRequirement = useCallback((id: string, content: string) => {
    setForm((f) => ({ ...f, requirements: f.requirements.map((r) => (r.id === id ? { ...r, content } : r)) }));
  }, []);

  const removeRequirement = useCallback((id: string) => {
    setForm((f) => ({ ...f, requirements: f.requirements.filter((r) => r.id !== id) }));
  }, []);

  // ─── agents ──────────────────────────────────────────────────────────

  const addAgent = useCallback((agentType: AgentId, role: AgentRole = "frontend") => {
    setForm((f) => ({ ...f, agents: [...f.agents, { id: nextDraftId(), agentType, role, customRole: "" }] }));
  }, []);

  const updateAgent = useCallback((id: string, patch: Partial<Omit<AgentDraft, "id">>) => {
    setForm((f) => ({ ...f, agents: f.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }, []);

  const removeAgent = useCallback((id: string) => {
    setForm((f) => ({ ...f, agents: f.agents.filter((a) => a.id !== id) }));
  }, []);

  // ─── submit ──────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    if (!form.title.trim()) { setError("작업 제목을 입력하세요."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const payload: UpdateTaskPayload = {
        title: form.title.trim(),
        workingDir: form.workingDir.trim() || undefined,
        requirements: form.requirements
          .filter((r) => r.content.trim())
          .map((r, i) => ({ content: r.content.trim(), orderIndex: i })),
        agents: form.agents.map((a) => ({
          agentType: a.agentType,
          role: a.role,
          customRole: a.role === "other" && a.customRole.trim() ? a.customRole.trim() : undefined,
        })),
      };
      const updated = await updateTask(task.id, payload);
      onSuccess?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSubmitting(false);
    }
  }, [form, task.id, onSuccess]);

  return {
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
  };
}
