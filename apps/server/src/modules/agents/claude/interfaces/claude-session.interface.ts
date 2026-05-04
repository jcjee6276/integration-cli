import type { IPty } from 'node-pty';

export type SessionStatus = 'idle' | 'running' | 'terminated';

export interface ClaudeSession {
  id: string;
  pty: IPty;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
  outputBuffer: string[];
}

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}
