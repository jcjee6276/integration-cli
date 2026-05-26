import { SERVER_URL } from "@/lib/constants";

export type AgentRole = "frontend" | "backend" | "doc" | "operation" | "other";

export interface TaskAgentRun {
  id: number;
  agentId: number;
  status: string;
  worktreePath: string | null;
  startCommitHash: string | null;
  durationMs: number | null;
  costUsd: number | null;
}

export interface TaskRun {
  id: number;
  version: number;
  supplementNote: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  agentRuns: TaskAgentRun[];
}

export interface TaskConversation {
  id: string;
  sessionId: string;
  promptId: string;
  agentId: number | null;
  runId: number | null;
  content: string;
  agentModel: string;
  type: "user_message" | "agent_message";
  createdAt: string;
}

export type TaskStatus = "pending" | "running" | "stopped" | "completed" | "error";
export type AgentStatus = "pending" | "running" | "stopped" | "completed" | "error";

export interface TaskRequirement {
  id: number;
  content: string;
  status: string;
  orderIndex: number;
}

export type AgentType = "claude" | "gemini" | "codex" | "opencode";

export interface TaskAgent {
  id: number;
  agentType: AgentType;
  role: AgentRole;
  customRole: string | null;
  status: AgentStatus;
  claudeSessionId?: string | null;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  workingDir: string | null;
  requirements: TaskRequirement[];
  agents: TaskAgent[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  workingDir?: string;
  requirements: { content: string; orderIndex: number }[];
  agents: { agentType: AgentType; role: AgentRole; customRole?: string }[];
}

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${SERVER_URL}/tasks`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function archiveTask(id: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/archive`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── 실행 제어 ────────────────────────────────────────────────────────────────

export async function executeTask(id: string): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/execute`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function stopTask(id: string): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTaskRuns(id: string): Promise<TaskRun[]> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/runs`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTaskConversations(id: string): Promise<TaskConversation[]> {
  const res = await fetch(`${SERVER_URL}/conversations/session/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function rerunTask(id: string, supplementNote?: string): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supplementNote }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function rerunTaskAgent(id: string, agentId: number, supplementNote?: string): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/agents/${agentId}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supplementNote }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
