import { SERVER_URL } from "@/lib/constants";

export interface AuthStatus {
  loggedIn: boolean;
  authMethod: string;
  apiProvider: string;
  email?: string;
  orgName?: string;
  subscriptionType?: string;
}

export interface ClaudeStatus {
  version: string;
  auth: AuthStatus;
  activeSessions: number;
  platform: string;
}

export interface GeminiAuthStatus {
  loggedIn: boolean;
  authMethod: string;
  installed: boolean;
  email?: string;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${SERVER_URL}/agents/claude/auth/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getClaudeStatus(): Promise<ClaudeStatus> {
  const res = await fetch(`${SERVER_URL}/agents/claude/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getGeminiAuthStatus(): Promise<GeminiAuthStatus> {
  const res = await fetch(`${SERVER_URL}/agents/gemini/auth/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function configureGeminiAuth(
  authType: "api-key",
  apiKey: string,
): Promise<void>;
export async function configureGeminiAuth(authType: "gca"): Promise<void>;
export async function configureGeminiAuth(
  authType: "api-key" | "gca",
  apiKey?: string,
): Promise<void> {
  const res = await fetch(`${SERVER_URL}/agents/gemini/auth/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authType, ...(apiKey ? { apiKey } : {}) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
