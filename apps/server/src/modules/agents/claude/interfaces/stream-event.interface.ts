/** Claude CLI --output-format stream-json 이벤트 타입 */

export interface TextDeltaEvent {
  sessionId: string;
  text: string;
}

export interface ToolUseEvent {
  sessionId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface ResultEvent {
  sessionId: string;
  result: string;
  isError: boolean;
  durationMs: number;
  costUsd: number;
}

export interface SessionExitEvent {
  sessionId: string;
  exitCode: number;
}

// ─── Claude CLI NDJSON raw 타입 ──────────────────────────────────────────────

export interface ClaudeInitEvent {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
}

export interface ClaudeAssistantEvent {
  type: 'assistant';
  session_id: string;
  message: {
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >;
  };
}

export interface ClaudeResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  session_id: string;
  result: string;
  is_error: boolean;
  duration_ms: number;
  total_cost_usd: number;
}

export type ClaudeStreamEvent =
  | ClaudeInitEvent
  | ClaudeAssistantEvent
  | ClaudeResultEvent
  | { type: string };
