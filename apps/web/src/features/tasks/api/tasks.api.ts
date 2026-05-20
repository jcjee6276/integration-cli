const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export type AgentRole = "frontend" | "backend" | "doc" | "operation" | "other";

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
  status: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
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

export async function deleteTask(id: string): Promise<void> {
  await fetch(`${SERVER_URL}/tasks/${id}`, { method: "DELETE" });
}
