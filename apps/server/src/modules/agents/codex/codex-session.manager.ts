import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

const IS_WIN = process.platform === 'win32';

import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
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

/**
 * codex exec 출력 형식:
 *   Reading additional input from stdin...
 *   OpenAI Codex vX.Y.Z
 *   --------
 *   workdir: ... / model: ... / ...
 *   --------
 *   user
 *   <user prompt echo>
 *   codex
 *   <actual response lines>
 *   tokens used
 *   <token count>
 *   <response duplicate>
 *
 * "codex" 섹션 내용만 emit하고, 나머지는 모두 버린다.
 */
type ParseState = 'header' | 'user_echo' | 'response' | 'done';

class CodexOutputParser {
  private state: ParseState = 'header';
  private lineBuffer = '';

  /** 청크를 받아 emit할 텍스트만 반환한다 (없으면 빈 문자열). */
  feed(raw: string): string {
    const text = raw.replace(ANSI_STRIP, '').replace(/\r/g, '');
    this.lineBuffer += text;

    const lines = this.lineBuffer.split('\n');
    this.lineBuffer = lines.pop() ?? '';

    let out = '';
    for (const line of lines) {
      out += this.handleLine(line);
    }
    return out;
  }

  /** 프로세스 종료 시 버퍼 플러시 */
  flush(): string {
    if (!this.lineBuffer) return '';
    const out = this.handleLine(this.lineBuffer);
    this.lineBuffer = '';
    return out;
  }

  private handleLine(line: string): string {
    if (this.state === 'done') return '';

    // 헤더 구간: 두 번째 '--------' 까지 모두 버림
    if (this.state === 'header') {
      if (line === '--------') this.state = 'user_echo';
      return '';
    }

    // 섹션 헤더 감지
    if (line === 'user') { this.state = 'user_echo'; return ''; }
    if (line === 'codex') { this.state = 'response'; return ''; }
    if (line === 'tokens used') { this.state = 'done'; return ''; }

    // user echo 줄 → 스킵하고 다음 섹션 헤더 대기
    if (this.state === 'user_echo') return '';

    // response 구간 → 그대로 출력
    if (this.state === 'response') return line + '\n';

    return '';
  }
}

@Injectable()
export class CodexSessionManager extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(CodexSessionManager.name);
  private readonly sessions = new Map<string, CodexSession>();
  private readonly processes = new Map<string, ChildProcess>();

  constructor(
    @InjectRepository(AgentSessionEntity)
    private readonly agentSessionRepo: Repository<AgentSessionEntity>,
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
    this.killProcess(id);
    this.sessions.delete(id);
    if (session.persisted) {
      void this.agentSessionRepo.update(id, { status: 'terminated' });
    }
    this.logger.log(`Terminated Codex session ${id}`);
  }

  sendMessage(sessionId: string, message: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      void this.restoreAndSend(sessionId, message);
      return;
    }
    if (existing.status === 'processing') throw new Error(`Session ${sessionId} is already processing`);

    existing.status = 'processing';
    existing.lastActivity = new Date();

    if (!existing.persisted) {
      void this.persistSession(existing).then(() => {
        if (existing.status === 'terminated' || !this.sessions.has(sessionId)) {
          void this.agentSessionRepo.update(sessionId, { status: 'terminated' });
          return;
        }
        this.spawnCodex(existing, message);
      });
      return;
    }

    void this.agentSessionRepo.update(sessionId, { status: 'processing' });
    this.spawnCodex(existing, message);
  }

  private async restoreAndSend(sessionId: string, message: string): Promise<void> {
    const record = await this.agentSessionRepo.findOne({ where: { id: sessionId } });
    if (!record) {
      const newSession = this.createSession();
      this.logger.log(`Session ${sessionId} not found — spawned new session ${newSession.id}`);
      this.emit('session:replaced', { oldSessionId: sessionId, newSessionId: newSession.id });
      this.sendMessage(newSession.id, message);
      return;
    }
    const now = new Date();
    const session: CodexSession = {
      id: sessionId,
      status: 'processing',
      workingDirectory: record.workingDirectory,
      createdAt: record.createdAt,
      lastActivity: now,
      persisted: true,
    };
    this.sessions.set(sessionId, session);
    this.logger.log(`Restored Codex session ${sessionId} (cwd: ${record.workingDirectory})`);
    void this.agentSessionRepo.update(sessionId, { status: 'processing' });
    this.spawnCodex(session, message);
  }

  private async persistSession(session: CodexSession): Promise<void> {
    const title = session.workingDirectory.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean).at(-1) ?? 'Codex';
    await Promise.all([
      this.agentSessionRepo.save({
        id: session.id,
        claudeSessionId: null,
        status: 'processing',
        workingDirectory: session.workingDirectory,
      }),
      this.sessionRepo.save({ sessionId: session.id, title, agentType: 'codex' }),
    ]);
    session.persisted = true;
    this.logger.log(`Persisted Codex session ${session.id} (${title})`);
  }

  private spawnCodex(session: CodexSession, message: string): void {
    const sessionId = session.id;
    const parser = new CodexOutputParser();

    const proc = spawn(
      'codex',
      [
        'exec',
        '-c', 'approval_policy=never',
        '-c', 'sandbox_mode=danger-full-access',
        message,
      ],
      {
        cwd: session.workingDirectory,
        env: this.authManager.getEnvForCodex(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: IS_WIN,
      },
    );
    this.processes.set(sessionId, proc);

    let output = '';

    const handleChunk = (chunk: Buffer) => {
      const filtered = parser.feed(chunk.toString());
      if (!filtered) return;
      output += filtered;
      this.emit('session:text', { sessionId, text: filtered });
    };

    proc.stdout.on('data', handleChunk);
    proc.stderr.on('data', handleChunk);

    proc.on('close', (exitCode) => {
      this.processes.delete(sessionId);
      const exitPayload = { sessionId, exitCode: exitCode ?? -1 };

      if (session.status === 'terminated' || !this.sessions.has(sessionId)) {
        this.emit('session:exit', exitPayload);
        return;
      }

      const tail = parser.flush();
      if (tail) { output += tail; this.emit('session:text', { sessionId, text: tail }); }

      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });
      const isError = (exitCode ?? 0) !== 0;
      this.emit('session:result', { sessionId, result: output.trim(), isError, durationMs: 0, costUsd: 0 });
      this.emit('session:exit', exitPayload);
      this.logger.log(`Codex session ${sessionId} finished (exit: ${exitCode})`);
    });

    proc.on('error', (err) => {
      this.processes.delete(sessionId);
      if (session.status === 'terminated' || !this.sessions.has(sessionId)) {
        return;
      }

      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });
      this.logger.error(`Codex session ${sessionId} spawn error: ${err.message}`);
      this.emit('error', { sessionId, message: err.message });
    });
  }

  onModuleDestroy(): void {
    for (const sessionId of this.processes.keys()) {
      this.killProcess(sessionId);
    }
    this.sessions.clear();
  }

  private killProcess(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (!proc) return;

    this.processes.delete(sessionId);
    try {
      if (!proc.killed) proc.kill('SIGTERM');
    } catch (err) {
      this.logger.warn(`Failed to kill Codex session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private toInfo(session: CodexSession): CodexSessionInfo {
    const { persisted: _p, ...info } = session;
    return info;
  }
}
