import { SERVER_URL } from "@/lib/constants";

export type HandoffAgentId = "claude" | "gemini" | "codex";

export interface AgentHandoffPayload {
  agentId: HandoffAgentId;
  request: string;
  projectPath?: string | null;
  filePath: string;
  fileName?: string;
  line?: number;
  endLine?: number;
  selectedText?: string;
}

export interface AgentHandoffResult {
  agentId: HandoffAgentId;
  sessionId: string;
  promptId: string;
  route: string;
}

export async function createAgentHandoff(
  payload: AgentHandoffPayload,
): Promise<AgentHandoffResult> {
  const res = await fetch(`${SERVER_URL}/handoff/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      projectPath: payload.projectPath ?? undefined,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
