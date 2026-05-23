import { execSync, spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
import { SessionEntity } from '../../../database/entities/session.entity';
import { GeminiAuthManager } from './gemini-auth.manager';
import type { GeminiSession, SessionInfo } from './interfaces/gemini-session.interface';
import type { ResultEvent, SessionExitEvent, TextDeltaEvent } from './interfaces/stream-event.interface';

@Injectable()
export class GeminiSessionManager extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeminiSessionManager.name);
  private readonly sessions = new Map<string, GeminiSession>();
  private readonly processes = new Map<string, ChildProcess>();
  private geminiBin = 'gemini';

  constructor(
    @InjectRepository(AgentSessionEntity)
    private readonly agentSessionRepo: Repository<AgentSessionEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    private readonly authManager: GeminiAuthManager,
  ) {
    super();
  }

  onModuleInit(): void {
    this.geminiBin = this.resolveGemini();
    this.logger.log(`gemini 경로: ${this.geminiBin}`);
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

    this.logger.log(`Created in-memory Gemini session ${id}`);
    return this.toSessionInfo(session);
  }

  terminateSession(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.status = 'terminated';
    this.killProcess(sessionId);
    this.sessions.delete(sessionId);

    if (session.persisted) {
      void this.agentSessionRepo.update(sessionId, { status: 'terminated' });
    }

    this.logger.log(`Terminated Gemini session ${sessionId}`);
  }

  // ─── 메시지 전송 ─────────────────────────────────────────────────────

  sendMessage(sessionId: string, message: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      void this.restoreAndSend(sessionId, message);
      return;
    }

    if (existing.status === 'processing') {
      throw new Error(`Gemini session ${sessionId} is already processing`);
    }

    existing.status = 'processing';
    existing.lastActivity = new Date();

    if (!existing.persisted) {
      void this.persistSession(existing).then(() => {
        if (existing.status === 'terminated' || !this.sessions.has(sessionId)) {
          void this.agentSessionRepo.update(sessionId, { status: 'terminated' });
          return;
        }
        this.spawnGemini(existing, message);
      });
      return;
    }

    void this.agentSessionRepo.update(sessionId, { status: 'processing' });
    this.spawnGemini(existing, message);
  }

  private async restoreAndSend(sessionId: string, message: string): Promise<void> {
    const record = await this.agentSessionRepo.findOne({ where: { id: sessionId } });
    if (!record) {
      this.emit('text-delta', { sessionId, text: '⚠ 세션을 찾을 수 없습니다.' });
      this.emit('result', { sessionId, isError: true });
      return;
    }
    const now = new Date();
    const session: GeminiSession = {
      id: sessionId,
      status: 'processing',
      workingDirectory: record.workingDirectory,
      createdAt: record.createdAt,
      lastActivity: now,
      persisted: true,
    };
    this.sessions.set(sessionId, session);
    this.logger.log(`Restored Gemini session ${sessionId} (cwd: ${record.workingDirectory})`);
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
    for (const sessionId of this.processes.keys()) {
      this.killProcess(sessionId);
    }
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

    this.logger.log(`[${sessionId}] spawning: ${this.geminiBin} -y -p <message>`);

    const proc = spawn(this.geminiBin, ['-y', '-p', message], {
      cwd: session.workingDirectory,
      env: this.authManager.getEnvForGemini(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.processes.set(sessionId, proc);

    // Gemini CLI는 stdout/stderr 모두에 출력 — 두 스트림 합산 캡처
    // ANSI 이스케이프 시퀀스(색상, 커서 이동 등) 전체 제거
    const handleChunk = (chunk: Buffer): void => {
      const raw = chunk.toString();
      const text = raw
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')  // CSI 시퀀스
        .replace(/\x1b\][^\x07]*\x07/g, '')         // OSC 시퀀스
        .replace(/\x1b[()][AB]/g, '')                // charset 지정
        .replace(/\r/g, '');
      if (!text.trim()) return;
      const event: TextDeltaEvent = { sessionId, text };
      this.emit('text-delta', event);
    };

    proc.stdout.on('data', handleChunk);
    proc.stderr.on('data', handleChunk);

    proc.on('close', (exitCode) => {
      this.processes.delete(sessionId);
      const exitEvent: SessionExitEvent = { sessionId, exitCode: exitCode ?? -1 };

      if (session.status === 'terminated' || !this.sessions.has(sessionId)) {
        this.emit('exit', exitEvent);
        return;
      }

      this.logger.log(`[${sessionId}] gemini exited with code ${exitCode}`);
      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });

      const resultEvent: ResultEvent = { sessionId, isError: (exitCode ?? 0) !== 0 };
      this.emit('result', resultEvent);

      this.emit('exit', exitEvent);
    });

    proc.on('error', (err) => {
      this.processes.delete(sessionId);
      if (session.status === 'terminated' || !this.sessions.has(sessionId)) {
        return;
      }

      this.logger.error(`[${sessionId}] spawn error: ${err.message}`);
      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });
      // 에러도 텍스트로 전달해서 UI에 표시
      this.emit('text-delta', { sessionId, text: `\n⚠ 실행 오류: ${err.message}\n` } as TextDeltaEvent);
      this.emit('result', { sessionId, isError: true } as ResultEvent);
    });
  }

  private resolveGemini(): string {
    const candidates = [
      (): string => execSync('which gemini', { encoding: 'utf8', timeout: 2000 }).trim(),
      (): string => {
        const home = process.env.HOME ?? '';
        const p = `${home}/.nvm/versions/node/${process.version}/bin/gemini`;
        if (fs.existsSync(p)) return p;
        throw new Error('not found');
      },
      (): string => {
        const npmBin = execSync('npm bin -g', { encoding: 'utf8', timeout: 2000 }).trim();
        const p = `${npmBin}/gemini`;
        if (fs.existsSync(p)) return p;
        throw new Error('not found');
      },
    ];

    for (const fn of candidates) {
      try { const p = fn(); if (p) return p; } catch {}
    }

    this.logger.warn('gemini 경로 탐지 실패 — "gemini"로 폴백');
    return 'gemini';
  }

  private requireSession(sessionId: string): GeminiSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException(`Gemini session ${sessionId} not found`);
    if (session.status === 'terminated') throw new Error(`Gemini session ${sessionId} is terminated`);
    return session;
  }

  private killProcess(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (!proc) return;

    this.processes.delete(sessionId);
    try {
      if (!proc.killed) proc.kill('SIGTERM');
    } catch (err) {
      this.logger.warn(`Failed to kill Gemini session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
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
