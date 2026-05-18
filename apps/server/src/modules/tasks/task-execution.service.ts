import { execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import type {
  ClaudeAssistantEvent,
  ClaudeResultEvent,
  ClaudeStreamEvent,
} from '../agents/claude/interfaces/stream-event.interface';

// ─── 이벤트 페이로드 ─────────────────────────────────────────────────────────

export interface AgentOutputEvent { taskId: string; agentId: number; text: string }
export interface AgentToolEvent   { taskId: string; agentId: number; tool: string; input: Record<string, unknown> }
export interface AgentDoneEvent   { taskId: string; agentId: number; result: string; isError: boolean; durationMs: number; costUsd: number }
export interface AgentErrorEvent  { taskId: string; agentId: number; message: string }
export interface TaskStatusEvent  { taskId: string; status: string }

// ─── 버퍼 엔트리 (늦은 구독자 리플레이용) ───────────────────────────────────

export interface BufferedAgentLog {
  agentId: number;
  status: string;
  output: string;
  durationMs?: number;
  costUsd?: number;
  errorMessage?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TaskExecutionService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskExecutionService.name);

  /** 서비스 초기화 시 해석된 claude 절대경로 */
  private claudeBin = 'claude';

  /** taskId → agentId → 로그 버퍼 (최대 24h 유지) */
  private readonly logBuffer = new Map<string, Map<number, BufferedAgentLog>>();
  /** taskId → pendingAgentId 집합 */
  private readonly pendingMap = new Map<string, Set<number>>();

  constructor(
    @InjectRepository(TaskAgentEntity)
    private readonly agentRepo: Repository<TaskAgentEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {
    super();
  }

  onModuleInit(): void {
    this.claudeBin = this.resolveClaude();
    this.logger.log(`claude 경로: ${this.claudeBin}`);
  }

  onModuleDestroy(): void {
    this.logBuffer.clear();
    this.pendingMap.clear();
  }

  // ─── 공개 API ─────────────────────────────────────────────────────────

  /** 태스크의 모든 에이전트 스폰 (TasksService에서 호출) */
  async spawnTask(task: TaskEntity): Promise<void> {
    if (!task.agents.length) {
      throw new Error('에이전트가 없습니다. 최소 하나의 에이전트를 추가하세요.');
    }

    const workingDir = this.resolveWorkingDir(task.workingDir);
    const reqList = [...task.requirements]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((r, i) => `${i + 1}. ${r.content}`)
      .join('\n');

    // 버퍼 초기화
    this.logBuffer.set(task.id, new Map());
    this.pendingMap.set(task.id, new Set(task.agents.map((a) => a.id)));

    for (const agent of task.agents) {
      const roleLabel = agent.role === 'other' && agent.customRole ? agent.customRole : agent.role;
      const prompt = [
        `당신은 ${roleLabel} 역할의 AI 에이전트입니다.`,
        `\n\n[작업 목표]\n${task.title}`,
        reqList ? `\n\n[요구사항]\n${reqList}` : '',
        `\n\n위 작업을 수행해주세요.`,
      ].join('');

      // 에이전트 상태 running으로 업데이트
      await this.agentRepo.update(agent.id, { status: 'running' });
      this.initAgentBuffer(task.id, agent.id);

      this.spawnAgent(task.id, task.title, agent.id, workingDir, prompt);
    }

    await this.taskRepo.update(task.id, { status: 'running' });
  }

  /** 태스크 강제 중지 (TasksService에서 호출) */
  async stopTask(task: TaskEntity): Promise<void> {
    const pending = this.pendingMap.get(task.id);
    if (pending) {
      pending.clear();
      this.pendingMap.delete(task.id);
    }

    for (const agent of task.agents) {
      if (agent.status === 'running') {
        await this.agentRepo.update(agent.id, { status: 'stopped' });
        this.updateAgentBuffer(task.id, agent.id, { status: 'stopped' });
        const ev: AgentErrorEvent = { taskId: task.id, agentId: agent.id, message: '수동으로 중지됐습니다.' };
        this.emit('agent:error', ev);
      }
    }

    await this.taskRepo.update(task.id, { status: 'stopped' });
    this.emit('task:status', { taskId: task.id, status: 'stopped' } as TaskStatusEvent);
  }

  /** 늦은 구독자를 위한 버퍼 반환 */
  getBufferedLogs(taskId: string): BufferedAgentLog[] {
    const agentMap = this.logBuffer.get(taskId);
    if (!agentMap) return [];
    return Array.from(agentMap.values());
  }

  // ─── 내부 스폰 로직 ───────────────────────────────────────────────────

  private spawnAgent(
    taskId: string,
    taskTitle: string,
    agentId: number,
    workingDir: string,
    prompt: string,
  ): void {
    const args = [
      '--output-format', 'stream-json',
      '--verbose',
      '--print',
      '--dangerously-skip-permissions',
      '-p', prompt,
    ];

    this.logger.log(`[Task:${taskTitle}] Agent ${agentId} 실행 — claude: ${this.claudeBin}, cwd: ${workingDir}`);

    const proc = spawn(this.claudeBin, args, {
      cwd: workingDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.logger.log(`[Task:${taskTitle}] Agent ${agentId} spawned (pid: ${proc.pid})`);

    let buffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.handleLine(taskId, agentId, trimmed);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      this.logger.warn(`[Task:${taskId}] Agent ${agentId} stderr: ${chunk.toString().slice(0, 200)}`);
    });

    proc.on('close', (exitCode) => {
      if (buffer.trim()) this.handleLine(taskId, agentId, buffer.trim());

      const pending = this.pendingMap.get(taskId);
      if (!pending?.has(agentId)) return; // already handled by result event

      // result 없이 종료 → 비정상
      this.logger.warn(`[Task:${taskId}] Agent ${agentId} exited (code: ${exitCode}) without result`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: `종료 코드: ${exitCode}` });

      const ev: AgentErrorEvent = { taskId, agentId, message: `프로세스가 코드 ${exitCode}로 종료됐습니다.` };
      this.emit('agent:error', ev);
      void this.checkTaskCompletion(taskId, agentId);
    });

    proc.on('error', (err) => {
      this.logger.error(`[Task:${taskId}] Agent ${agentId} spawn error: ${err.message}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });

      const ev: AgentErrorEvent = { taskId, agentId, message: err.message };
      this.emit('agent:error', ev);
      void this.checkTaskCompletion(taskId, agentId);
    });
  }

  // ─── Stream-JSON 파싱 ─────────────────────────────────────────────────

  private handleLine(taskId: string, agentId: number, line: string): void {
    let event: ClaudeStreamEvent;
    try { event = JSON.parse(line) as ClaudeStreamEvent; }
    catch { return; }

    switch (event.type) {
      case 'assistant': {
        const e = event as ClaudeAssistantEvent;
        for (const block of e.message.content) {
          if (block.type === 'text' && block.text.trim()) {
            // 버퍼에 누적
            const prev = this.getAgentBuffer(taskId, agentId);
            this.updateAgentBuffer(taskId, agentId, { output: prev.output + block.text });

            const ev: AgentOutputEvent = { taskId, agentId, text: block.text };
            this.emit('agent:output', ev);
          }
          if (block.type === 'tool_use') {
            const toolLine = `\n⚙ ${block.name}(${JSON.stringify(block.input).slice(0, 120)})\n`;
            const prev = this.getAgentBuffer(taskId, agentId);
            this.updateAgentBuffer(taskId, agentId, { output: prev.output + toolLine });

            const ev: AgentToolEvent = { taskId, agentId, tool: block.name, input: block.input };
            this.emit('agent:tool', ev);
          }
        }
        break;
      }

      case 'result': {
        const e = event as ClaudeResultEvent;
        const status = e.is_error ? 'error' : 'completed';

        void this.agentRepo.update(agentId, { status });
        this.updateAgentBuffer(taskId, agentId, {
          status,
          durationMs: e.duration_ms,
          costUsd: e.total_cost_usd,
        });

        const doneEv: AgentDoneEvent = {
          taskId,
          agentId,
          result: e.result,
          isError: e.is_error,
          durationMs: e.duration_ms,
          costUsd: e.total_cost_usd,
        };
        this.emit('agent:done', doneEv);
        void this.checkTaskCompletion(taskId, agentId);
        break;
      }
    }
  }

  // ─── 완료 감지 ────────────────────────────────────────────────────────

  private async checkTaskCompletion(taskId: string, agentId: number): Promise<void> {
    const pending = this.pendingMap.get(taskId);
    if (!pending) return;
    pending.delete(agentId);

    if (pending.size > 0) return; // 아직 실행 중인 에이전트 존재
    this.pendingMap.delete(taskId);

    const agents = await this.agentRepo.find({ where: { taskId } });
    const hasError = agents.some((a) => a.status === 'error');
    const newStatus = hasError ? 'error' : 'completed';

    await this.taskRepo.update(taskId, { status: newStatus });

    this.emit('task:status', { taskId, status: newStatus } as TaskStatusEvent);
    this.logger.log(`Task ${taskId} → ${newStatus}`);
  }

  // ─── 버퍼 헬퍼 ────────────────────────────────────────────────────────

  private initAgentBuffer(taskId: string, agentId: number): void {
    if (!this.logBuffer.has(taskId)) this.logBuffer.set(taskId, new Map());
    this.logBuffer.get(taskId)!.set(agentId, { agentId, status: 'running', output: '' });
  }

  private getAgentBuffer(taskId: string, agentId: number): BufferedAgentLog {
    return this.logBuffer.get(taskId)?.get(agentId) ?? { agentId, status: 'running', output: '' };
  }

  private updateAgentBuffer(taskId: string, agentId: number, patch: Partial<BufferedAgentLog>): void {
    const agentMap = this.logBuffer.get(taskId);
    if (!agentMap) return;
    const cur = agentMap.get(agentId) ?? { agentId, status: 'running', output: '' };
    agentMap.set(agentId, { ...cur, ...patch });
  }

  // ─── 환경 헬퍼 ────────────────────────────────────────────────────────

  /**
   * claude 바이너리 절대경로 해석.
   * nvm/volta 등 버전 매니저 환경에서 PATH가 제한될 수 있어 which로 확인 후 폴백.
   */
  private resolveClaude(): string {
    const candidates = [
      // which 명령으로 현재 PATH에서 탐색
      (): string => execSync('which claude', { encoding: 'utf8', timeout: 2000 }).trim(),
      // nvm 기본 경로
      (): string => {
        const home = process.env.HOME ?? '';
        const nvmDefault = `${home}/.nvm/versions/node/${process.version}/bin/claude`;
        if (fs.existsSync(nvmDefault)) return nvmDefault;
        throw new Error('not found');
      },
      // npm global bin
      (): string => {
        const npmBin = execSync('npm bin -g', { encoding: 'utf8', timeout: 2000 }).trim();
        const p = `${npmBin}/claude`;
        if (fs.existsSync(p)) return p;
        throw new Error('not found');
      },
    ];

    for (const fn of candidates) {
      try {
        const p = fn();
        if (p) return p;
      } catch {}
    }

    this.logger.warn('claude 바이너리 경로를 자동 탐지하지 못했습니다. "claude"로 폴백합니다.');
    return 'claude';
  }

  /**
   * workingDir 유효성 검사.
   * 지정된 경로가 존재하지 않으면 서버 CWD로 폴백하여 ENOENT를 방지.
   */
  private resolveWorkingDir(workingDir: string | null): string {
    if (!workingDir) return process.cwd();
    if (fs.existsSync(workingDir)) return workingDir;

    this.logger.warn(`workingDir "${workingDir}" 이(가) 존재하지 않습니다. 서버 CWD로 폴백합니다.`);
    return process.cwd();
  }
}
