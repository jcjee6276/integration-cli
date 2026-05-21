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

    setLoading(true);
    setError(null);

    fetchTaskChangelog(taskId)
      .then(setChangelogs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  return { changelogs, loading, error };
}
