import { Injectable } from '@nestjs/common';

import { ClaudePtyManager } from './claude-pty.manager';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { ResizeSessionDto } from './dto/resize-session.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

@Injectable()
export class ClaudeService {
  constructor(private readonly ptyManager: ClaudePtyManager) {}

  createSession(dto: CreateSessionDto): SessionInfo {
    return this.ptyManager.createSession(dto.workingDirectory, dto.env);
  }

  terminateSession(sessionId: string): void {
    this.ptyManager.terminateSession(sessionId);
  }

  sendInput(sessionId: string, input: string): void {
    this.ptyManager.sendInput(sessionId, input);
  }

  sendLine(sessionId: string, line: string): void {
    this.ptyManager.sendLine(sessionId, line);
  }

  resize(sessionId: string, dto: ResizeSessionDto): void {
    this.ptyManager.resize(sessionId, dto.cols, dto.rows);
  }

  getSession(sessionId: string): SessionInfo {
    return this.ptyManager.getSessionInfo(sessionId);
  }

  listSessions(): SessionInfo[] {
    return this.ptyManager.listSessions();
  }

  getOutputBuffer(sessionId: string): string[] {
    return this.ptyManager.getOutputBuffer(sessionId);
  }
}
