export type SessionStatus = 'idle' | 'processing' | 'terminated';

export interface ClaudeSession {
  id: string;
  /** Claude CLI가 발급한 session_id — --resume에 사용 */
  claudeSessionId: string | null;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
  /** 첫 메시지 전송 전까지 false — DB에 아직 적재되지 않은 상태 */
  persisted: boolean;
}

export interface SessionInfo {
  id: string;
  claudeSessionId: string | null;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}
