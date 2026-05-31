import { SERVER_URL } from "@/lib/constants";

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  title: string;
  claudeSessionId?: string | null;
  status?: string;
  workingDirectory?: string;
  model?: string | null;
  reasoning?: string | null;
  createdAt: string;
}

export interface CreateAgentSessionPayload {
  workingDirectory?: string;
  model?: string;
  reasoning?: string;
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

export async function fetchDBSessions(agentType?: string): Promise<DBSession[]> {
  const url = agentType
    ? `${SERVER_URL}/sessions?agentType=${agentType}`
    : `${SERVER_URL}/sessions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function compactPayload(payload?: CreateAgentSessionPayload | string): CreateAgentSessionPayload {
  if (typeof payload === "string") {
    return payload ? { workingDirectory: payload } : {};
  }
  return Object.fromEntries(
    Object.entries(payload ?? {}).filter(([, value]) => value !== undefined && value !== ""),
  ) as CreateAgentSessionPayload;
}

export async function createSession(payload?: CreateAgentSessionPayload | string): Promise<SessionInfo> {
  const res = await fetch(`${SERVER_URL}/agents/claude/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compactPayload(payload)),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/agents/claude/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function createGeminiSession(workingDirectory?: string): Promise<SessionInfo> {
  const res = await fetch(`${SERVER_URL}/agents/gemini/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workingDirectory ? { workingDirectory } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteGeminiSession(id: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/agents/gemini/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function saveGeminiConversation(
  sessionId: string,
  promptId: string,
  content: string,
  type: ConversationType,
): void {
  void fetch(`${SERVER_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, promptId, content, agentModel: "gemini", type }),
  }).catch(() => undefined);
}

export async function createCodexSession(payload?: CreateAgentSessionPayload | string): Promise<SessionInfo> {
  const res = await fetch(`${SERVER_URL}/agents/codex/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compactPayload(payload)),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteCodexSession(id: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/agents/codex/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function saveCodexConversation(
  sessionId: string,
  promptId: string,
  content: string,
  type: ConversationType,
): void {
  void fetch(`${SERVER_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, promptId, content, agentModel: "codex", type }),
  }).catch(() => undefined);
}

// ─── Session Title ───────────────────────────────────────────────────────────

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/sessions/${sessionId}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
