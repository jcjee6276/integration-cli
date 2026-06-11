"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { archiveTask, deleteTask, executeTask, fetchTasks, rerunTask, rerunTaskAgent, stopTask } from "../api/tasks.api";
import type { AgentTestCodePreference, Task, TaskStatus } from "../api/tasks.api";

export function useTaskList(open: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 편집 대상 태스크
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // 폴링: running 상태인 작업이 있으면 3초마다 새로고침
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  // 모달 열릴 때 로드
  useEffect(() => {
    if (!open) return;
    void loadTasks();
  }, [open, loadTasks]);

  // running 작업이 있으면 폴링
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === "running");
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(() => void loadTasks(), 3000);
    }
    if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [tasks, loadTasks]);

  // ─── 액션 ────────────────────────────────────────────────────────────

  const execute = useCallback(async (id: string, agentTestCodePreferences: AgentTestCodePreference[] = []) => {
    setActioningId(id);
    try {
      const updated = await executeTask(id, agentTestCodePreferences);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "실행 실패");
    } finally {
      setActioningId(null);
    }
  }, []);

  const stop = useCallback(async (id: string) => {
    setActioningId(id);
    try {
      const updated = await stopTask(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "중지 실패");
    } finally {
      setActioningId(null);
    }
  }, []);

  const rerun = useCallback(async (id: string, supplementNote?: string, writeTestCode?: boolean) => {
    setActioningId(id);
    try {
      const updated = await rerunTask(id, supplementNote, writeTestCode);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "재 실행 실패");
    } finally {
      setActioningId(null);
    }
  }, []);

  const rerunAgent = useCallback(async (id: string, agentId: number, supplementNote?: string, writeTestCode?: boolean) => {
    setActioningId(id);
    try {
      const updated = await rerunTaskAgent(id, agentId, supplementNote, writeTestCode);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "에이전트 재실행 실패");
    } finally {
      setActioningId(null);
    }
  }, []);

  const archive = useCallback(async (id: string) => {
    setActioningId(id);
    try {
      await archiveTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "보관 실패");
    } finally {
      setActioningId(null);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setActioningId(id);
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setActioningId(null);
    }
  }, []);

  const onEditDone = useCallback(
    (updated: Task) => {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTask(null);
    },
    [],
  );

  // WS 이벤트로 task status가 바뀔 때 로컬 state 반영
  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
    );
  }, []);

  return {
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
    rerunAgent,
    archive,
    remove,
    onEditDone,
    updateTaskStatus,
  };
}
