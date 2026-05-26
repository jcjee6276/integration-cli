import { SERVER_URL } from "@/lib/constants";

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export interface ChangelogFile {
  id: number;
  filePath: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface AgentChangelog {
  agentId: number;
  files: ChangelogFile[];
}

export interface MergeResult {
  success: boolean;
  message: string;
}

export async function fetchTaskChangelog(taskId: string, signal?: AbortSignal): Promise<AgentChangelog[]> {
  const res = await fetch(`${SERVER_URL}/tasks/${taskId}/changelog`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTaskRunChangelog(taskId: string, runId: number, signal?: AbortSignal): Promise<AgentChangelog[]> {
  const res = await fetch(`${SERVER_URL}/tasks/${taskId}/runs/${runId}/changelog`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function mergeAgentAll(taskId: string, agentId: number): Promise<MergeResult> {
  const res = await fetch(`${SERVER_URL}/tasks/${taskId}/agents/${agentId}/merge`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function mergeAgentFile(taskId: string, agentId: number, filePath: string): Promise<MergeResult> {
  const res = await fetch(`${SERVER_URL}/tasks/${taskId}/agents/${agentId}/merge-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
