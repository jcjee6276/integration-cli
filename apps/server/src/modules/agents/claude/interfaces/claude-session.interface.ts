export type SessionStatus = 'idle' | 'processing' | 'terminated';

export interface ClaudeSession {
  id: string;
  /** Claude CLI가 발급한 session_id — --resume에 사용 */
  claudeSessionId: string | null;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface SessionInfo {
  id: string;
  claudeSessionId: string | null;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}
