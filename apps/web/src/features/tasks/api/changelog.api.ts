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

export async function fetchTaskChangelog(taskId: string): Promise<AgentChangelog[]> {
  const res = await fetch(`${SERVER_URL}/tasks/${taskId}/changelog`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
