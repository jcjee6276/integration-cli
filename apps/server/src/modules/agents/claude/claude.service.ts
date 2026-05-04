import { Injectable } from '@nestjs/common';

import { ClaudePtyManager } from './claude-pty.manager';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

@Injectable()
export class ClaudeService {
  constructor(private readonly ptyManager: ClaudePtyManager) {}

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
}
