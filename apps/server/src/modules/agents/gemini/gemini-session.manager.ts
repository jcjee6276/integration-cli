import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
import { SessionEntity } from '../../../database/entities/session.entity';
import { GeminiAuthManager } from './gemini-auth.manager';
import type { GeminiSession, SessionInfo } from './interfaces/gemini-session.interface';
import type { ResultEvent, SessionExitEvent, TextDeltaEvent } from './interfaces/stream-event.interface';

@Injectable()
export class GeminiSessionManager extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(GeminiSessionManager.name);
  private readonly sessions = new Map<string, GeminiSession>();

  constructor(
    @InjectRepository(AgentSessionEntity)
    private readonly agentSessionRepo: Repository<AgentSessionEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    private readonly authManager: GeminiAuthManager,
  ) {
    super();
  }

  // ─── 세션 생명주기 ───────────────────────────────────────────────────

  createSession(workingDirectory = process.cwd()): SessionInfo {
    const id = uuidv4();
    const now = new Date();
    const session: GeminiSession = {
      id,
      status: 'idle',
      workingDirectory,
      createdAt: now,
      lastActivity: now,
      persisted: false,
    };
    this.sessions.set(id, session);

    // DB 적재는 첫 메시지 전송 시 수행
    this.logger.log(`Created in-memory Gemini session ${id}`);
    return this.toSessionInfo(session);
  }

  terminateSession(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.status = 'terminated';
    this.sessions.delete(sessionId);

    if (session.persisted) {
      void this.agentSessionRepo.update(sessionId, { status: 'terminated' });
    }

    this.logger.log(`Terminated Gemini session ${sessionId}`);
  }

  // ─── 메시지 전송 ─────────────────────────────────────────────────────

  sendMessage(sessionId: string, message: string): void {
    const session = this.requireSession(sessionId);
    if (session.status === 'processing') {
      throw new Error(`Gemini session ${sessionId} is already processing`);
    }

    session.status = 'processing';
    session.lastActivity = new Date();

    if (!session.persisted) {
      void this.persistSession(session).then(() => this.spawnGemini(session, message));
      return;
    }

    void this.agentSessionRepo.update(sessionId, { status: 'processing' });
    this.spawnGemini(session, message);
  }

  // ─── 조회 ────────────────────────────────────────────────────────────

  getSessionInfo(sessionId: string): SessionInfo {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException(`Gemini session ${sessionId} not found`);
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
    this.logger.log('All Gemini sessions cleared');
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private async persistSession(session: GeminiSession): Promise<void> {
    const title = path.basename(session.workingDirectory) || session.workingDirectory;
    await Promise.all([
      this.agentSessionRepo.save({
        id: session.id,
        claudeSessionId: null,
        status: 'processing',
        workingDirectory: session.workingDirectory,
      }),
      this.sessionRepo.save({ sessionId: session.id, title, agentType: 'gemini' }),
    ]);
    session.persisted = true;
    this.logger.log(`Persisted Gemini session ${session.id} (${title})`);
  }

  private spawnGemini(session: GeminiSession, message: string): void {
    const sessionId = session.id;

    const proc = spawn('gemini', ['-p', message], {
      cwd: session.workingDirectory,
      env: this.authManager.getEnvForGemini(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (!text) return;
      const event: TextDeltaEvent = { sessionId, text };
      this.emit('text-delta', event);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      this.logger.warn(`[${sessionId}] stderr: ${chunk.toString()}`);
    });

    proc.on('close', (exitCode) => {
      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });

      const resultEvent: ResultEvent = { sessionId, isError: (exitCode ?? 0) !== 0 };
      this.emit('result', resultEvent);

      const exitEvent: SessionExitEvent = { sessionId, exitCode: exitCode ?? -1 };
      this.emit('exit', exitEvent);
    });

    proc.on('error', (err) => {
      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });
      this.logger.error(`[${sessionId}] spawn error: ${err.message}`);
      this.emit('error', { sessionId, message: err.message });
    });
  }

  private requireSession(sessionId: string): GeminiSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException(`Gemini session ${sessionId} not found`);
    if (session.status === 'terminated') throw new Error(`Gemini session ${sessionId} is terminated`);
    return session;
  }

  private toSessionInfo(session: GeminiSession): SessionInfo {
    return {
      id: session.id,
      status: session.status,
      workingDirectory: session.workingDirectory,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
  }
}
