"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchTaskRunChangelog } from "../api/changelog.api";
import type { AgentChangelog } from "../api/changelog.api";
import { fetchTaskConversations, fetchTaskRuns } from "../api/tasks.api";
import type { AgentRole, Task, TaskConversation, TaskRun } from "../api/tasks.api";

export type DetailStatusFilter = "all" | "error" | "completed";
export type DetailAgentFilter = "all" | number;
export type DetailRoleFilter = "all" | AgentRole;
export type DetailVersionFilter = "all" | number;

export interface DetailVersion {
  run: TaskRun;
  changelogs: AgentChangelog[];
  logsByAgent: Record<number, string>;
  additions: number;
  deletions: number;
  fileCount: number;
}

interface RunChangelog {
  runId: number;
  changelogs: AgentChangelog[];
}

function appendLog(target: Record<number, string>, conversation: TaskConversation): void {
  if (conversation.type !== "agent_message" || conversation.agentId == null) return;
  target[conversation.agentId] = `${target[conversation.agentId] ?? ""}${conversation.content}`;
}

export function useTaskDetail(task: Task | null) {
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [conversations, setConversations] = useState<TaskConversation[]>([]);
  const [runChangelogs, setRunChangelogs] = useState<RunChangelog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agentFilter, setAgentFilter] = useState<DetailAgentFilter>("all");
  const [roleFilter, setRoleFilter] = useState<DetailRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<DetailStatusFilter>("all");
  const [versionFilter, setVersionFilter] = useState<DetailVersionFilter>("all");

  useEffect(() => {
    if (!task) {
      setRuns([]);
      setConversations([]);
      setRunChangelogs([]);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const taskId = task.id;

    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [nextRuns, nextConversations] = await Promise.all([
          fetchTaskRuns(taskId),
          fetchTaskConversations(taskId),
        ]);
        const changelogResults = await Promise.all(
          nextRuns.map(async (run) => ({
            runId: run.id,
            changelogs: await fetchTaskRunChangelog(taskId, run.id, controller.signal).catch(() => []),
          })),
        );

        if (!active) return;
        setRuns(nextRuns);
        setConversations(nextConversations);
        setRunChangelogs(changelogResults);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "상세 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [task]);

  useEffect(() => {
    setAgentFilter("all");
    setRoleFilter("all");
    setStatusFilter("all");
    setVersionFilter("all");
  }, [task?.id]);

  const versions = useMemo<DetailVersion[]>(() => {
    const changelogByRun = new Map(runChangelogs.map((entry) => [entry.runId, entry.changelogs]));
    const logsByRun = new Map<number, Record<number, string>>();

    for (const conversation of conversations) {
      if (conversation.runId == null) continue;
      const current = logsByRun.get(conversation.runId) ?? {};
      appendLog(current, conversation);
      logsByRun.set(conversation.runId, current);
    }

    return runs.map((run) => {
      const changelogs = changelogByRun.get(run.id) ?? [];
      const files = changelogs.flatMap((entry) => entry.files);
      return {
        run,
        changelogs,
        logsByAgent: logsByRun.get(run.id) ?? {},
        additions: files.reduce((sum, file) => sum + file.additions, 0),
        deletions: files.reduce((sum, file) => sum + file.deletions, 0),
        fileCount: files.length,
      };
    });
  }, [conversations, runChangelogs, runs]);

  const filteredVersions = useMemo(() => {
    if (!task) return [];

    const agentById = new Map(task.agents.map((agent) => [agent.id, agent]));

    const agentMatches = (agentId: number) => {
      if (agentFilter !== "all" && agentFilter !== agentId) return false;
      const agent = agentById.get(agentId);
      if (roleFilter !== "all" && agent?.role !== roleFilter) return false;
      return true;
    };

    const statusMatches = (run: TaskRun, agentId: number) => {
      if (statusFilter === "all") return true;
      return run.agentRuns.some((agentRun) => agentRun.agentId === agentId && agentRun.status === statusFilter);
    };

    return versions
      .filter((version) => versionFilter === "all" || version.run.id === versionFilter)
      .map((version) => {
        const visibleAgentIds = new Set<number>();
        for (const agentRun of version.run.agentRuns) visibleAgentIds.add(agentRun.agentId);
        for (const agentId of Object.keys(version.logsByAgent)) visibleAgentIds.add(Number(agentId));
        for (const changelog of version.changelogs) visibleAgentIds.add(changelog.agentId);

        const allowedAgentIds = new Set(
          Array.from(visibleAgentIds).filter((agentId) => agentMatches(agentId) && statusMatches(version.run, agentId)),
        );

        const changelogs = version.changelogs
          .filter((changelog) => allowedAgentIds.has(changelog.agentId))
          .map((changelog) => ({ ...changelog, files: [...changelog.files] }));

        const logsByAgent = Object.fromEntries(
          Object.entries(version.logsByAgent).filter(([agentId]) => allowedAgentIds.has(Number(agentId))),
        );

        const files = changelogs.flatMap((entry) => entry.files);
        return {
          ...version,
          changelogs,
          logsByAgent,
          run: {
            ...version.run,
            agentRuns: version.run.agentRuns.filter((agentRun) => allowedAgentIds.has(agentRun.agentId)),
          },
          additions: files.reduce((sum, file) => sum + file.additions, 0),
          deletions: files.reduce((sum, file) => sum + file.deletions, 0),
          fileCount: files.length,
        };
      })
      .filter((version) => (
        version.run.agentRuns.length > 0 ||
        Object.keys(version.logsByAgent).length > 0 ||
        version.changelogs.length > 0 ||
        (agentFilter === "all" && roleFilter === "all" && statusFilter === "all")
      ));
  }, [agentFilter, roleFilter, statusFilter, task, versionFilter, versions]);

  const roleOptions = useMemo(() => {
    const roles = new Set<AgentRole>();
    task?.agents.forEach((agent) => roles.add(agent.role));
    return Array.from(roles);
  }, [task]);

  const totals = useMemo(() => ({
    versions: versions.length,
    files: versions.reduce((sum, version) => sum + version.fileCount, 0),
    additions: versions.reduce((sum, version) => sum + version.additions, 0),
    deletions: versions.reduce((sum, version) => sum + version.deletions, 0),
    errors: runs.reduce((sum, run) => sum + run.agentRuns.filter((agentRun) => agentRun.status === "error").length, 0),
    completed: runs.reduce((sum, run) => sum + run.agentRuns.filter((agentRun) => agentRun.status === "completed").length, 0),
  }), [runs, versions]);

  return {
    agentFilter,
    error,
    filteredVersions,
    loading,
    roleFilter,
    roleOptions,
    runs,
    setAgentFilter,
    setRoleFilter,
    setStatusFilter,
    setVersionFilter,
    statusFilter,
    totals,
    versionFilter,
    versions,
  };
}
