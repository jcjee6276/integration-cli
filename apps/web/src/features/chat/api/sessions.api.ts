import { SERVER_URL } from "@/lib/constants";

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  title: string;
  claudeSessionId?: string | null;
  status?: string;
  workingDirectory?: string;
  createdAt: string;
}

export interface DBSession {
  sessionId: string;
  title: string;
  createdAt: string;
}

export interface DBConversation {
  id: string;
  sessionId: string;
  promptId: string;
  content: string;
  agentModel: string;
  type: "user_message" | "agent_message";
  createdAt: string;
}

export type ConversationType = "user_message" | "agent_message";

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function fetchDBSessions(): Promise<DBSession[]> {
  const res = await fetch(`${SERVER_URL}/sessions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createSession(workingDirectory?: string): Promise<SessionInfo> {
  const res = await fetch(`${SERVER_URL}/agents/claude/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workingDirectory ? { workingDirectory } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${SERVER_URL}/agents/claude/sessions/${id}`, { method: "DELETE" });
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function fetchConversations(sessionId: string): Promise<DBConversation[]> {
  const res = await fetch(`${SERVER_URL}/conversations/session/${sessionId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function saveConversation(
  sessionId: string,
  promptId: string,
  content: string,
  type: ConversationType,
): void {
  void fetch(`${SERVER_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, promptId, content, agentModel: "claude", type }),
  }).catch(() => undefined);
}
