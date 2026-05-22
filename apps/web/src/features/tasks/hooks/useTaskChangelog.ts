"use client";

import { useEffect, useState } from "react";

import type { AgentChangelog } from "../api/changelog.api";
import { fetchTaskChangelog } from "../api/changelog.api";

export function useTaskChangelog(taskId: string | null) {
  const [changelogs, setChangelogs] = useState<AgentChangelog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setChangelogs([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchTaskChangelog(taskId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setChangelogs(data); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => { controller.abort(); };
  }, [taskId]);

  return { changelogs, loading, error };
}
