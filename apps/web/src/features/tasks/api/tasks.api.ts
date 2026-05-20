import { SERVER_URL } from "@/lib/constants";

export type AgentRole = "frontend" | "backend" | "doc" | "operation" | "other";

export type TaskStatus = "pending" | "running" | "stopped" | "completed" | "error";
export type AgentStatus = "pending" | "running" | "stopped" | "completed" | "error";

export interface TaskRequirement {
  id: number;
  content: string;
  status: string;
  orderIndex: number;
}

export interface TaskAgent {
  id: number;
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
  agents: { role: AgentRole; customRole?: string }[];
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

export async function deleteTask(id: string): Promise<void> {
  await fetch(`${SERVER_URL}/tasks/${id}`, { method: "DELETE" });
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

export async function rerunTask(id: string, supplementNote?: string): Promise<Task> {
  const res = await fetch(`${SERVER_URL}/tasks/${id}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supplementNote }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
