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

export interface BatchHandoffItem {
  title: string;
  route?: string;
  filePath?: string;
  line?: number;
  endLine?: number;
  detail?: string;
}

export interface AgentHandoffBatchPayload {
  agentId: HandoffAgentId;
  projectPath?: string | null;
  instruction?: string;
  items: BatchHandoffItem[];
}

export interface AgentHandoffBatchResult extends AgentHandoffResult {
  count: number;
}

/** 여러 이슈를 단일 에이전트 세션·단일 프롬프트로 위임 */
export async function createBatchHandoff(
  payload: AgentHandoffBatchPayload,
): Promise<AgentHandoffBatchResult> {
  const res = await fetch(`${SERVER_URL}/handoff/agent/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: payload.agentId,
      projectPath: payload.projectPath ?? undefined,
      instruction: payload.instruction,
      items: payload.items,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
