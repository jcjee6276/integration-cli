import { EventEmitter } from 'events';

import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';

import type { ClaudeSession, SessionInfo } from './interfaces/claude-session.interface';
import type { PtyExitEvent, PtyOutputEvent } from './interfaces/pty-event.interface';

const PTY_COLS = 220;
const PTY_ROWS = 50;
const OUTPUT_BUFFER_MAX = 500;

@Injectable()
export class ClaudePtyManager extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudePtyManager.name);
  private readonly sessions = new Map<string, ClaudeSession>();

  // ─── Session lifecycle ──────────────────────────────────────────────

  createSession(workingDirectory = process.cwd(), env?: Record<string, string>): SessionInfo {
    const id = uuidv4();

    const ptyProcess = pty.spawn('claude', [], {
      name: 'xterm-color',
      cols: PTY_COLS,
      rows: PTY_ROWS,
      cwd: workingDirectory,
      env: { ...process.env, ...env },
    });

    const session: ClaudeSession = {
      id,
      pty: ptyProcess,
      status: 'running',
      workingDirectory,
      createdAt: new Date(),
      lastActivity: new Date(),
      outputBuffer: [],
    };

    ptyProcess.onData((data: string) => {
      session.lastActivity = new Date();
      session.outputBuffer.push(data);

      if (session.outputBuffer.length > OUTPUT_BUFFER_MAX) {
        session.outputBuffer.shift();
      }

      const event: PtyOutputEvent = { sessionId: id, data, timestamp: new Date() };
      this.emit('output', event);
    });

    ptyProcess.onExit(({ exitCode }) => {
      session.status = 'terminated';
      this.logger.log(`Session ${id} exited with code ${exitCode ?? 'unknown'}`);

      const event: PtyExitEvent = { sessionId: id, exitCode: exitCode ?? -1 };
      this.emit('exit', event);
      this.sessions.delete(id);
    });

    this.sessions.set(id, session);
    this.logger.log(`Created PTY session ${id} (cwd: ${workingDirectory})`);

    return this.toSessionInfo(session);
  }

  terminateSession(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.pty.kill();
    this.logger.log(`Terminated session ${sessionId}`);
  }

  // ─── PTY interaction ────────────────────────────────────────────────

  sendInput(sessionId: string, input: string): void {
    const session = this.requireSession(sessionId);
    session.pty.write(input);
    session.lastActivity = new Date();
  }

  sendLine(sessionId: string, line: string): void {
    this.sendInput(sessionId, `${line}\r`);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.requireSession(sessionId);
    session.pty.resize(cols, rows);
    this.logger.debug(`Resized session ${sessionId} to ${cols}x${rows}`);
  }

  // ─── Queries ────────────────────────────────────────────────────────

  getSessionInfo(sessionId: string): SessionInfo {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return this.toSessionInfo(session);
  }

  listSessions(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => this.toSessionInfo(s));
  }

  getOutputBuffer(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return [...session.outputBuffer];
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  onModuleDestroy(): void {
    for (const session of this.sessions.values()) {
      try {
        session.pty.kill();
      } catch {
        // best-effort on shutdown
      }
    }
    this.sessions.clear();
    this.logger.log('All PTY sessions terminated');
  }

  // ─── Private ────────────────────────────────────────────────────────

  private requireSession(sessionId: string): ClaudeSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  private toSessionInfo(session: ClaudeSession): SessionInfo {
    return {
      id: session.id,
      status: session.status,
      workingDirectory: session.workingDirectory,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
  }
}
