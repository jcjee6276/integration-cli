"use client";

import { useCallback, useState } from "react";

import { createTask } from "../api/tasks.api";
import type { AgentRole, CreateTaskPayload, Task } from "../api/tasks.api";
import type { AgentId } from "@/features/chat/ui/AgentSelectModal";

export interface AgentDraft {
  id: string; // 로컬 임시 key
  agentType: AgentId;
  role: AgentRole;
  customRole: string;
}

export interface RequirementDraft {
  id: string;
  content: string;
}

export interface TaskFormState {
  title: string;
  workingDir: string;
  requirements: RequirementDraft[];
  agents: AgentDraft[];
}

const INITIAL_STATE: TaskFormState = {
  title: "",
  workingDir: "",
  requirements: [],
  agents: [],
};

let draftId = 0;
const nextDraftId = () => String(++draftId);

export function useTaskCreate(onSuccess?: (task: Task) => void) {
  const [form, setForm] = useState<TaskFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── title / workingDir ──────────────────────────────────────────────

  const setTitle = useCallback((v: string) => setForm((f) => ({ ...f, title: v })), []);
  const setWorkingDir = useCallback((v: string) => setForm((f) => ({ ...f, workingDir: v })), []);

  // ─── requirements ────────────────────────────────────────────────────

  const addRequirement = useCallback(() => {
    setForm((f) => ({
      ...f,
      requirements: [...f.requirements, { id: nextDraftId(), content: "" }],
    }));
  }, []);

  const updateRequirement = useCallback((id: string, content: string) => {
    setForm((f) => ({
      ...f,
      requirements: f.requirements.map((r) => (r.id === id ? { ...r, content } : r)),
    }));
  }, []);

  const removeRequirement = useCallback((id: string) => {
    setForm((f) => ({
      ...f,
      requirements: f.requirements.filter((r) => r.id !== id),
    }));
  }, []);

  // ─── agents ──────────────────────────────────────────────────────────

  const addAgent = useCallback((agentType: AgentId, role: AgentRole = "frontend") => {
    setForm((f) => ({
      ...f,
      agents: [...f.agents, { id: nextDraftId(), agentType, role, customRole: "" }],
    }));
  }, []);

  const updateAgent = useCallback((id: string, patch: Partial<Omit<AgentDraft, "id">>) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
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
      const payload: CreateTaskPayload = {
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
      const task = await createTask(payload);
      setForm(INITIAL_STATE);
      onSuccess?.(task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "작업 생성 실패");
    } finally {
      setSubmitting(false);
    }
  }, [form, onSuccess]);

  const reset = useCallback(() => { setForm(INITIAL_STATE); setError(null); }, []);

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
    reset,
  };
}
