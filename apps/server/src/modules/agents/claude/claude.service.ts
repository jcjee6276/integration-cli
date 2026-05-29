import { execSync } from 'child_process';
import * as os from 'os';

import { Injectable } from '@nestjs/common';

import { ClaudeAuthManager } from './claude-auth.manager';
import { ClaudePtyManager } from './claude-pty.manager';
import type { ClaudeCreateSessionDto as CreateSessionDto } from './dto/create-session.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

export interface ClaudeStatus {
  version: string;
  auth: {
    loggedIn: boolean;
    authMethod: string;
    apiProvider: string;
    email?: string;
    orgName?: string;
    subscriptionType?: string;
  };
  activeSessions: number;
  platform: string;
}

@Injectable()
export class ClaudeService {
  constructor(
    private readonly ptyManager: ClaudePtyManager,
    private readonly authManager: ClaudeAuthManager,
  ) {}

  createSession(dto: CreateSessionDto): SessionInfo {
    return this.ptyManager.createSession(dto.workingDirectory);
  }

  terminateSession(sessionId: string): void {
    this.ptyManager.terminateSession(sessionId);
  }

  sendMessage(sessionId: string, message: string): void {
    this.ptyManager.sendMessage(sessionId, message);
  }

  getSession(sessionId: string): SessionInfo {
    return this.ptyManager.getSessionInfo(sessionId);
  }

  listSessions(): SessionInfo[] {
    return this.ptyManager.listSessions();
  }

  async getStatus(): Promise<ClaudeStatus> {
    let version = 'unknown';
    try {
      version = execSync('claude --version', { encoding: 'utf8', timeout: 3000 }).trim();
    } catch {}

    const auth = await this.authManager.getAuthStatus();

    return {
      version,
      auth,
      activeSessions: this.ptyManager.listSessions().length,
      platform: `${os.platform()} ${os.arch()}`,
    };
  }
}
