"use client";

import { useEffect, useState } from "react";

import { fetchTaskRuns } from "../api/tasks.api";
import type { TaskRun } from "../api/tasks.api";

export function useTaskRuns(taskId: string | null) {
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setRuns([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchTaskRuns(taskId)
      .then((data) => { if (!controller.signal.aborted) setRuns(data); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => { controller.abort(); };
  }, [taskId]);

  return { runs, loading, error };
}
