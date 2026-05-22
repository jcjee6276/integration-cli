import { spawn } from 'child_process';
import { EventEmitter } from 'events';

import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { SessionEntity } from '../../../database/entities/session.entity';
import { CodexAuthManager } from './codex-auth.manager';

export interface CodexSessionInfo {
  id: string;
  status: 'idle' | 'processing' | 'terminated';
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}

interface CodexSession extends CodexSessionInfo {
  persisted: boolean;
}

const ANSI_STRIP = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07/g;

@Injectable()
export class CodexSessionManager extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(CodexSessionManager.name);
  private readonly sessions = new Map<string, CodexSession>();

  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    private readonly authManager: CodexAuthManager,
  ) {
    super();
  }

  createSession(workingDirectory = process.cwd()): CodexSessionInfo {
    const id = uuidv4();
    const now = new Date();
    const session: CodexSession = {
      id,
      status: 'idle',
      workingDirectory,
      createdAt: now,
      lastActivity: now,
      persisted: false,
    };
    this.sessions.set(id, session);
    this.logger.log(`Created Codex session ${id} (cwd: ${workingDirectory})`);
    return this.toInfo(session);
  }

  getSession(id: string): CodexSessionInfo {
    const session = this.sessions.get(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return this.toInfo(session);
  }

  listSessions(): CodexSessionInfo[] {
    return [...this.sessions.values()].map((s) => this.toInfo(s));
  }

  terminateSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    session.status = 'terminated';
    this.sessions.delete(id);
    this.logger.log(`Terminated Codex session ${id}`);
  }

  sendMessage(sessionId: string, message: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.status === 'processing') throw new Error(`Session ${sessionId} is already processing`);

    session.status = 'processing';
    session.lastActivity = new Date();

    if (!session.persisted) {
      void this.persistSession(session).then(() => this.spawnCodex(session, message));
      return;
    }

    this.spawnCodex(session, message);
  }

  private async persistSession(session: CodexSession): Promise<void> {
    const title = session.workingDirectory.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean).at(-1) ?? 'Codex';
    await this.sessionRepo.save({ sessionId: session.id, title, agentType: 'codex' });
    session.persisted = true;
    this.logger.log(`Persisted Codex session ${session.id} (${title})`);
  }

  private spawnCodex(session: CodexSession, message: string): void {
    const sessionId = session.id;

    const proc = spawn(
      'codex',
      [
        'exec',
        '-c', 'approval_policy="never"',
        '-c', 'sandbox_mode="danger-full-access"',
        message,
      ],
      {
        cwd: session.workingDirectory,
        env: this.authManager.getEnvForCodex(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let output = '';

    const handleChunk = (chunk: Buffer) => {
      const text = chunk.toString().replace(ANSI_STRIP, '').replace(/\r/g, '');
      if (!text.trim()) return;
      output += text;
      this.emit('session:text', { sessionId, text });
    };

    proc.stdout.on('data', handleChunk);
    proc.stderr.on('data', handleChunk);

    proc.on('close', (exitCode) => {
      session.status = 'idle';
      const isError = (exitCode ?? 0) !== 0;
      this.emit('session:result', { sessionId, result: output.trim(), isError, durationMs: 0, costUsd: 0 });
      this.emit('session:exit', { sessionId, exitCode: exitCode ?? -1 });
      this.logger.log(`Codex session ${sessionId} finished (exit: ${exitCode})`);
    });

    proc.on('error', (err) => {
      session.status = 'idle';
      this.logger.error(`Codex session ${sessionId} spawn error: ${err.message}`);
      this.emit('error', { sessionId, message: err.message });
    });
  }

  onModuleDestroy(): void {
    this.sessions.clear();
  }

  private toInfo(session: CodexSession): CodexSessionInfo {
    const { persisted: _p, ...info } = session;
    return info;
  }
}
