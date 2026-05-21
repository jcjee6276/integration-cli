export type SessionStatus = 'idle' | 'processing' | 'terminated';

export interface GeminiSession {
  id: string;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
  persisted: boolean;
}

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}
