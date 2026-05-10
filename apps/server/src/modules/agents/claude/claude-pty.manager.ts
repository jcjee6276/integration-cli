import { spawn } from 'child_process';
import { EventEmitter } from 'events';

import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import type { ClaudeSession, SessionInfo } from './interfaces/claude-session.interface';
import type {
  ClaudeAssistantEvent,
  ClaudeInitEvent,
  ClaudeResultEvent,
  ClaudeStreamEvent,
  ResultEvent,
  SessionExitEvent,
  TextDeltaEvent,
  ToolUseEvent,
} from './interfaces/stream-event.interface';

@Injectable()
export class ClaudePtyManager extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudePtyManager.name);
  private readonly sessions = new Map<string, ClaudeSession>();

  // ─── 세션 생명주기 ───────────────────────────────────────────────────

  createSession(workingDirectory = process.cwd()): SessionInfo {
    const id = uuidv4();
    const session: ClaudeSession = {
      id,
      claudeSessionId: null,
      status: 'idle',
      workingDirectory,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    this.sessions.set(id, session);
    this.logger.log(`Created session ${id}`);
    return this.toSessionInfo(session);
  }

  terminateSession(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.status = 'terminated';
    this.sessions.delete(sessionId);
    this.logger.log(`Terminated session ${sessionId}`);
  }

  // ─── 메시지 전송 ─────────────────────────────────────────────────────

  sendMessage(sessionId: string, message: string): void {
    const session = this.requireSession(sessionId);
    if (session.status === 'processing') {
      throw new Error(`Session ${sessionId} is already processing`);
    }

    session.status = 'processing';
    session.lastActivity = new Date();

    const args = ['--output-format', 'stream-json', '--verbose', '--print', '-p', message];
    if (session.claudeSessionId) {
      args.push('--resume', session.claudeSessionId);
    }

    const proc = spawn('claude', args, {
      cwd: session.workingDirectory,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let buffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.handleLine(sessionId, session, trimmed);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      this.logger.warn(`[${sessionId}] stderr: ${chunk.toString()}`);
    });

    proc.on('close', (exitCode) => {
      if (buffer.trim()) {
        this.handleLine(sessionId, session, buffer.trim());
      }
      buffer = '';
      session.status = 'idle';

      const event: SessionExitEvent = { sessionId, exitCode: exitCode ?? -1 };
      this.emit('exit', event);
    });

    proc.on('error', (err) => {
      session.status = 'idle';
      this.logger.error(`[${sessionId}] spawn error: ${err.message}`);
      this.emit('error', { sessionId, message: err.message });
    });
  }

  // ─── NDJSON 파싱 ─────────────────────────────────────────────────────

  private handleLine(sessionId: string, session: ClaudeSession, line: string): void {
    let event: ClaudeStreamEvent;
    try {
      event = JSON.parse(line) as ClaudeStreamEvent;
    } catch {
      this.logger.debug(`[${sessionId}] non-JSON line: ${line}`);
      return;
    }

    switch (event.type) {
      case 'system': {
        const e = event as ClaudeInitEvent;
        if (e.subtype === 'init') {
          session.claudeSessionId = e.session_id;
          this.logger.debug(`[${sessionId}] Claude session: ${e.session_id}, model: ${e.model}`);
        }
        break;
      }

      case 'assistant': {
        const e = event as ClaudeAssistantEvent;
        for (const block of e.message.content) {
          if (block.type === 'text') {
            const textEvent: TextDeltaEvent = { sessionId, text: block.text };
            this.emit('text-delta', textEvent);
          } else if (block.type === 'tool_use') {
            const toolEvent: ToolUseEvent = {
              sessionId,
              tool: block.name,
              input: block.input,
            };
            this.emit('tool-use', toolEvent);
          }
        }
        break;
      }

      case 'result': {
        const e = event as ClaudeResultEvent;
        const resultEvent: ResultEvent = {
          sessionId,
          result: e.result,
          isError: e.is_error,
          durationMs: e.duration_ms,
          costUsd: e.total_cost_usd,
        };
        this.emit('result', resultEvent);
        break;
      }

      default:
        break;
    }
  }

  // ─── 조회 ────────────────────────────────────────────────────────────

  getSessionInfo(sessionId: string): SessionInfo {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return this.toSessionInfo(session);
  }

  listSessions(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => this.toSessionInfo(s));
  }

  // ─── 정리 ────────────────────────────────────────────────────────────

  onModuleDestroy(): void {
    for (const session of this.sessions.values()) {
      session.status = 'terminated';
    }
    this.sessions.clear();
    this.logger.log('All sessions cleared');
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private requireSession(sessionId: string): ClaudeSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.status === 'terminated') throw new Error(`Session ${sessionId} is terminated`);
    return session;
  }

  private toSessionInfo(session: ClaudeSession): SessionInfo {
    return {
      id: session.id,
      claudeSessionId: session.claudeSessionId,
      status: session.status,
      workingDirectory: session.workingDirectory,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
  }
}
