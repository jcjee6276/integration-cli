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
