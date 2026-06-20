"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { deleteTask, fetchArchivedTasks, unarchiveTask } from "../api/tasks.api";
import type { Task } from "../api/tasks.api";

let archivedTasksCache: Task[] | null = null;
let archivedTasksRequest: Promise<Task[]> | null = null;

type ArchivedTaskAction = "restore" | "delete";

async function readArchivedTasks(force = false): Promise<Task[]> {
  if (!force && archivedTasksCache) return archivedTasksCache;
  if (!force && archivedTasksRequest) return archivedTasksRequest;

  archivedTasksRequest = fetchArchivedTasks()
    .then((tasks) => {
      archivedTasksCache = tasks;
      return tasks;
    })
    .finally(() => {
      archivedTasksRequest = null;
    });

  return archivedTasksRequest;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useArchivedTasks() {
  const mountedRef = useRef(false);
  const [tasks, setTasks] = useState<Task[]>(() => archivedTasksCache ?? []);
  const [loading, setLoading] = useState(() => archivedTasksCache === null);
  const [actioningTask, setActioningTask] = useState<{
    id: string;
    action: ArchivedTaskAction;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const loadInitialTasks = async () => {
      try {
        const nextTasks = await readArchivedTasks();
        if (!mountedRef.current) return;
        setTasks(nextTasks);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(toErrorMessage(err, "보관된 작업을 불러오지 못했습니다"));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    void loadInitialTasks();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const removeArchivedTask = useCallback((id: string) => {
    if (archivedTasksCache) {
      archivedTasksCache = archivedTasksCache.filter((task) => task.id !== id);
    }
    if (!mountedRef.current) return;
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const restoreTask = useCallback(
    async (id: string) => {
      setActioningTask({ id, action: "restore" });
      setError(null);

      try {
        await unarchiveTask(id);
        removeArchivedTask(id);
      } catch (err) {
        if (mountedRef.current) setError(toErrorMessage(err, "작업 보관 해제에 실패했습니다"));
      } finally {
        if (mountedRef.current) setActioningTask(null);
      }
    },
    [removeArchivedTask],
  );

  const removeTask = useCallback(
    async (id: string) => {
      setActioningTask({ id, action: "delete" });
      setError(null);

      try {
        await deleteTask(id);
        removeArchivedTask(id);
      } catch (err) {
        if (mountedRef.current) setError(toErrorMessage(err, "작업 삭제에 실패했습니다"));
      } finally {
        if (mountedRef.current) setActioningTask(null);
      }
    },
    [removeArchivedTask],
  );

  return {
    tasks,
    loading,
    actioningTask,
    error,
    restoreTask,
    removeTask,
  };
}
