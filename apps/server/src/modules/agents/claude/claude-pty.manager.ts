import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
import { SessionEntity } from '../../../database/entities/session.entity';
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

const CLAUDE_REASONING_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function normalizeModel(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'default') return null;
  return trimmed;
}

function normalizeReasoning(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'default') return null;
  return CLAUDE_REASONING_LEVELS.has(trimmed) ? trimmed : null;
}

@Injectable()
export class ClaudePtyManager extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudePtyManager.name);
  private readonly sessions = new Map<string, ClaudeSession>();
  private readonly processes = new Map<string, ChildProcess>();

  constructor(
    @InjectRepository(AgentSessionEntity)
    private readonly agentSessionRepo: Repository<AgentSessionEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
  ) {
    super();
  }

  // ─── 세션 생명주기 ───────────────────────────────────────────────────

  createSession(workingDirectory = process.cwd(), model?: string, reasoning?: string): SessionInfo {
    const id = uuidv4();
    const now = new Date();
    const session: ClaudeSession = {
      id,
      claudeSessionId: null,
      status: 'idle',
      workingDirectory,
      model: normalizeModel(model),
      reasoning: normalizeReasoning(reasoning),
      createdAt: now,
      lastActivity: now,
      persisted: false,
    };
    this.sessions.set(id, session);

    // DB 적재는 첫 메시지 전송 시 수행 (sendMessage 참고)
    this.logger.log(`Created in-memory session ${id} (workingDirectory: ${workingDirectory})`);
    return this.toSessionInfo(session);
  }

  /** 세션을 DB에 처음으로 적재한다. persisted 플래그를 세우기 전에 호출해야 한다. */
  private async persistSession(session: ClaudeSession): Promise<void> {
    const title = path.basename(session.workingDirectory) || session.workingDirectory;
    await Promise.all([
      this.agentSessionRepo.save({
        id: session.id,
        claudeSessionId: null,
        status: 'processing',
        workingDirectory: session.workingDirectory,
        model: session.model,
        reasoning: session.reasoning,
      }),
      this.sessionRepo.save({ sessionId: session.id, title, agentType: 'claude' }),
    ]);
    session.persisted = true;
    this.logger.log(`Persisted session ${session.id} (${title})`);
  }

  terminateSession(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.status = 'terminated';
    this.killProcess(sessionId);
    this.sessions.delete(sessionId);

    if (session.persisted) {
      void this.agentSessionRepo.update(sessionId, { status: 'terminated' });
    }

    this.logger.log(`Terminated session ${sessionId}`);
  }

  // ─── 메시지 전송 ─────────────────────────────────────────────────────

  sendMessage(sessionId: string, message: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      void this.restoreAndSend(sessionId, message);
      return;
    }

    if (existing.status === 'processing') {
      throw new Error(`Session ${sessionId} is already processing`);
    }

    existing.status = 'processing';
    existing.lastActivity = new Date();

    if (!existing.persisted) {
      void this.persistSession(existing).then(() => {
        if (existing.status === 'terminated' || !this.sessions.has(sessionId)) {
          void this.agentSessionRepo.update(sessionId, { status: 'terminated' });
          return;
        }
        this.spawnClaude(existing, message);
      });
      return;
    }

    void this.agentSessionRepo.update(sessionId, { status: 'processing' });
    this.spawnClaude(existing, message);
  }

  private async restoreAndSend(
    sessionId: string,
    message: string,
    model?: string,
    reasoning?: string,
  ): Promise<void> {
    const record = await this.agentSessionRepo.findOne({ where: { id: sessionId } });
    if (!record) {
      this.emit('error', { sessionId, message: '세션을 찾을 수 없습니다.' });
      return;
    }
    const now = new Date();
    const session: ClaudeSession = {
      id: sessionId,
      claudeSessionId: record.claudeSessionId,
      status: 'processing',
      workingDirectory: record.workingDirectory,
      model: normalizeModel(record.model),
      reasoning: normalizeReasoning(record.reasoning),
      createdAt: record.createdAt,
      lastActivity: now,
      persisted: true,
    };
    this.updateModelSettings(session, model, reasoning);
    this.sessions.set(sessionId, session);
    this.logger.log(`Restored Claude session ${sessionId} (claudeSessionId: ${record.claudeSessionId ?? 'none'})`);
    void this.agentSessionRepo.update(sessionId, { status: 'processing' });
    this.spawnClaude(session, message);
  }

  private updateModelSettings(session: ClaudeSession, model?: string, reasoning?: string): void {
    const nextModel = normalizeModel(model);
    const nextReasoning = normalizeReasoning(reasoning);
    if (model !== undefined) session.model = nextModel;
    if (reasoning !== undefined) session.reasoning = nextReasoning;
    if (session.persisted && (model !== undefined || reasoning !== undefined)) {
      void this.agentSessionRepo.update(session.id, {
        model: session.model,
        reasoning: session.reasoning,
      });
    }
  }

  sendMessageWithSettings(sessionId: string, message: string, model?: string, reasoning?: string): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.updateModelSettings(existing, model, reasoning);
      this.sendMessage(sessionId, message);
      return;
    }
    void this.restoreAndSend(sessionId, message, model, reasoning);
  }

  private spawnClaude(session: ClaudeSession, message: string): void {
    const sessionId = session.id;

    const args = ['--output-format', 'stream-json', '--verbose'];
    if (session.model) {
      args.push('--model', session.model);
    }
    if (session.reasoning) {
      args.push('--effort', session.reasoning);
    }
    args.push('--print', '-p', message);
    if (session.claudeSessionId) {
      args.push('--resume', session.claudeSessionId);
    }

    const proc = spawn('claude', args, {
      cwd: session.workingDirectory,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.processes.set(sessionId, proc);

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
      this.processes.delete(sessionId);
      const event: SessionExitEvent = { sessionId, exitCode: exitCode ?? -1 };

      if (session.status === 'terminated' || !this.sessions.has(sessionId)) {
        this.emit('exit', event);
        return;
      }

      if (buffer.trim()) {
        this.handleLine(sessionId, session, buffer.trim());
      }
      buffer = '';
      session.status = 'idle';

      void this.agentSessionRepo.update(sessionId, { status: 'idle' });

      this.emit('exit', event);
    });

    proc.on('error', (err) => {
      this.processes.delete(sessionId);
      if (session.status === 'terminated' || !this.sessions.has(sessionId)) {
        return;
      }

      session.status = 'idle';
      void this.agentSessionRepo.update(sessionId, { status: 'idle' });
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
          void this.agentSessionRepo.update(sessionId, { claudeSessionId: e.session_id });
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
    for (const sessionId of this.processes.keys()) {
      this.killProcess(sessionId);
    }
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

  private killProcess(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (!proc) return;

    this.processes.delete(sessionId);
    try {
      if (!proc.killed) proc.kill('SIGTERM');
    } catch (err) {
      this.logger.warn(`Failed to kill Claude session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private toSessionInfo(session: ClaudeSession): SessionInfo {
    return {
      id: session.id,
      claudeSessionId: session.claudeSessionId,
      status: session.status,
      workingDirectory: session.workingDirectory,
      model: session.model,
      reasoning: session.reasoning,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    };
  }
}
