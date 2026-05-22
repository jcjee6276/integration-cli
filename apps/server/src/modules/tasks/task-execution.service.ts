import { execSync, spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import * as fs from 'fs';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { GeminiAuthManager } from '../agents/gemini/gemini-auth.manager';
import { ConversationService } from '../conversations/conversation.service';
import { AgentModel, ConversationType } from '../conversations/enums/conversation.enum';
import { GitChangelogService } from '../changelog/changelog.service';
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
export interface TaskStatusEvent  { taskId: string; status: string; title?: string }

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

  private claudeBin = 'claude';
  private geminiBin = 'gemini';
  private codexBin = 'codex';

  /** taskId → agentId → 로그 버퍼 */
  private readonly logBuffer = new Map<string, Map<number, BufferedAgentLog>>();
  /** taskId → pendingAgentId 집합 */
  private readonly pendingMap = new Map<string, Set<number>>();
  /** `${taskId}-${agentId}` → promptId */
  private readonly promptIdMap = new Map<string, string>();
  /** `${taskId}-${agentId}` → { worktreePath, branchName, mainRepoDir } */
  private readonly worktreeMap = new Map<string, { worktreePath: string; branchName: string; mainRepoDir: string }>();
  /** result 이벤트를 수신한 에이전트 키 (`${taskId}-${agentId}`) 집합 */
  private readonly resultReceivedSet = new Set<string>();

  constructor(
    @InjectRepository(TaskAgentEntity)
    private readonly agentRepo: Repository<TaskAgentEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly geminiAuthManager: GeminiAuthManager,
    private readonly conversationService: ConversationService,
    private readonly gitChangelogService: GitChangelogService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.claudeBin = this.resolveClaude();
    this.logger.log(`claude 경로: ${this.claudeBin}`);
    this.geminiBin = this.resolveGemini();
    this.logger.log(`gemini 경로: ${this.geminiBin}`);
    this.codexBin = this.resolveCodex();
    this.logger.log(`codex 경로: ${this.codexBin}`);
  }

  onModuleDestroy(): void {
    this.logBuffer.clear();
    this.pendingMap.clear();
    this.promptIdMap.clear();
    this.worktreeMap.clear();
    this.resultReceivedSet.clear();
  }

  // ─── 공개 API ─────────────────────────────────────────────────────────

  async spawnTask(task: TaskEntity, supplementNote?: string): Promise<void> {
    if (!task.agents.length) {
      throw new Error('에이전트가 없습니다. 최소 하나의 에이전트를 추가하세요.');
    }

    const workingDir = this.resolveWorkingDir(task.workingDir);
    const isGitRepo = this.gitChangelogService.isGitRepo(workingDir);

    const reqList = [...task.requirements]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((r, i) => `${i + 1}. ${r.content}`)
      .join('\n');

    this.logBuffer.set(task.id, new Map());
    this.pendingMap.set(task.id, new Set(task.agents.map((a) => a.id)));

    for (const agent of task.agents) {
      const roleLabel = agent.role === 'other' && agent.customRole ? agent.customRole : agent.role;
      const prompt = [
        `당신은 ${roleLabel} 역할의 AI 에이전트입니다.`,
        `\n\n[작업 목표]\n${task.title}`,
        reqList ? `\n\n[요구사항]\n${reqList}` : '',
        supplementNote ? `\n\n[이전 결과 보완 사항]\n${supplementNote}` : '',
        `\n\n위 작업을 수행해주세요.`,
      ].join('');

      await this.agentRepo.update(agent.id, { status: 'running' });
      this.initAgentBuffer(task.id, agent.id);

      const promptId = uuidv4();
      this.promptIdMap.set(`${task.id}-${agent.id}`, promptId);
      void this.conversationService.create({
        sessionId: task.id,
        promptId,
        content: prompt,
        agentModel: (agent.agentType === 'gemini' ? AgentModel.GEMINI : AgentModel.CLAUDE),
        type: ConversationType.USER_MESSAGE,
        agentId: agent.id,
      });

      // git repo인 경우 에이전트별 worktree 생성
      let agentWorkDir = workingDir;
      if (isGitRepo) {
        try {
          const { worktreePath, branchName } = this.gitChangelogService.createWorktree(workingDir, agent.id);
          const startCommitHash = this.gitChangelogService.getCurrentHead(workingDir);
          await this.agentRepo.update(agent.id, { worktreePath, startCommitHash });
          this.worktreeMap.set(`${task.id}-${agent.id}`, { worktreePath, branchName, mainRepoDir: workingDir });
          agentWorkDir = worktreePath;
        } catch (err) {
          this.logger.warn(`Agent ${agent.id} worktree 생성 실패, 원본 디렉토리 사용: ${err}`);
        }
      }

      if (agent.agentType === 'gemini') {
        this.spawnGeminiAgent(task.id, task.title, agent.id, agentWorkDir, prompt);
      } else if (agent.agentType === 'codex') {
        this.spawnCodexAgent(task.id, task.title, agent.id, agentWorkDir, prompt);
      } else {
        this.spawnClaudeAgent(task.id, task.title, agent.id, agentWorkDir, prompt);
      }
    }

    await this.taskRepo.update(task.id, { status: 'running' });
    this.emit('task:status', { taskId: task.id, status: 'running', title: task.title } as TaskStatusEvent);
  }

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
    this.emit('task:status', { taskId: task.id, status: 'stopped', title: task.title } as TaskStatusEvent);
  }

  getBufferedLogs(taskId: string): BufferedAgentLog[] {
    const agentMap = this.logBuffer.get(taskId);
    if (!agentMap) return [];
    return Array.from(agentMap.values());
  }

  // ─── Claude 스폰 ──────────────────────────────────────────────────────

  private spawnClaudeAgent(
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

    this.logger.log(`[Task:${taskTitle}] Claude Agent ${agentId} 실행 — cwd: ${workingDir}`);

    const proc = spawn(this.claudeBin, args, {
      cwd: workingDir,
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
        if (trimmed) this.handleClaudeLine(taskId, agentId, trimmed);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      this.logger.warn(`[Task:${taskId}] Claude Agent ${agentId} stderr: ${chunk.toString().slice(0, 200)}`);
    });

    proc.on('close', (exitCode) => {
      if (buffer.trim()) this.handleClaudeLine(taskId, agentId, buffer.trim());

      const key = `${taskId}-${agentId}`;
      const hadResult = this.resultReceivedSet.delete(key);

      if (!hadResult) {
        // result 이벤트 없이 종료 → 오류 처리
        this.logger.warn(`[Task:${taskId}] Claude Agent ${agentId} exited (code: ${exitCode}) without result`);
        void this.agentRepo.update(agentId, { status: 'error' });
        this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: `종료 코드: ${exitCode}` });
        this.emit('agent:error', { taskId, agentId, message: `프로세스가 코드 ${exitCode}로 종료됐습니다.` } as AgentErrorEvent);
      }

      void this.finalizeAgent(taskId, agentId);
    });

    proc.on('error', (err) => {
      this.logger.error(`[Task:${taskId}] Claude Agent ${agentId} spawn error: ${err.message}`);
      this.resultReceivedSet.delete(`${taskId}-${agentId}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });
      this.emit('agent:error', { taskId, agentId, message: err.message } as AgentErrorEvent);
      void this.finalizeAgent(taskId, agentId);
    });
  }

  // ─── Codex 스폰 ───────────────────────────────────────────────────────

  private spawnCodexAgent(
    taskId: string,
    taskTitle: string,
    agentId: number,
    workingDir: string,
    prompt: string,
  ): void {
    this.logger.log(`[Task:${taskTitle}] Codex Agent ${agentId} 실행 — cwd: ${workingDir}`);

    const proc = spawn(
      this.codexBin,
      [
        'exec',
        '-c', 'approval_policy="never"',
        '-c', 'sandbox_mode="danger-full-access"',
        prompt,
      ],
      {
        cwd: workingDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let output = '';

    const handleChunk = (chunk: Buffer): void => {
      const raw = chunk.toString();
      const text = raw
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\r/g, '');
      if (!text.trim()) return;
      output += text;
      const prev = this.getAgentBuffer(taskId, agentId);
      this.updateAgentBuffer(taskId, agentId, { output: prev.output + text });
      this.emit('agent:output', { taskId, agentId, text } as AgentOutputEvent);
    };

    proc.stdout.on('data', handleChunk);
    proc.stderr.on('data', handleChunk);

    proc.on('close', (exitCode) => {
      const isError = (exitCode ?? 0) !== 0;
      const status = isError ? 'error' : 'completed';

      void this.agentRepo.update(agentId, { status });
      this.updateAgentBuffer(taskId, agentId, { status });

      if (isError) {
        this.updateAgentBuffer(taskId, agentId, { errorMessage: `종료 코드: ${exitCode}` });
      }

      this.emit('agent:done', {
        taskId,
        agentId,
        result: output.trim(),
        isError,
        durationMs: 0,
        costUsd: 0,
      } as AgentDoneEvent);
      void this.finalizeAgent(taskId, agentId);
    });

    proc.on('error', (err) => {
      this.logger.error(`[Task:${taskId}] Codex Agent ${agentId} spawn error: ${err.message}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });
      this.emit('agent:error', { taskId, agentId, message: err.message } as AgentErrorEvent);
      void this.finalizeAgent(taskId, agentId);
    });
  }

  // ─── Gemini 스폰 ──────────────────────────────────────────────────────

  private spawnGeminiAgent(
    taskId: string,
    taskTitle: string,
    agentId: number,
    workingDir: string,
    prompt: string,
  ): void {
    this.logger.log(`[Task:${taskTitle}] Gemini Agent ${agentId} 실행 — bin: ${this.geminiBin}, cwd: ${workingDir}`);

    const proc = spawn(this.geminiBin, ['-y', '-p', prompt], {
      cwd: workingDir,
      env: this.geminiAuthManager.getEnvForGemini(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';

    const handleChunk = (chunk: Buffer): void => {
      const raw = chunk.toString();
      const text = raw
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\r/g, '');
      if (!text.trim()) return;
      output += text;
      const prev = this.getAgentBuffer(taskId, agentId);
      this.updateAgentBuffer(taskId, agentId, { output: prev.output + text });
      this.emit('agent:output', { taskId, agentId, text } as AgentOutputEvent);
    };

    proc.stdout.on('data', handleChunk);
    proc.stderr.on('data', handleChunk);

    proc.on('close', (exitCode) => {
      const isError = (exitCode ?? 0) !== 0;
      const status = isError ? 'error' : 'completed';

      void this.agentRepo.update(agentId, { status });
      this.updateAgentBuffer(taskId, agentId, { status });

      if (isError) {
        this.updateAgentBuffer(taskId, agentId, { errorMessage: `종료 코드: ${exitCode}` });
      }

      this.emit('agent:done', {
        taskId,
        agentId,
        result: output.trim(),
        isError,
        durationMs: 0,
        costUsd: 0,
      } as AgentDoneEvent);
      void this.finalizeAgent(taskId, agentId);
    });

    proc.on('error', (err) => {
      this.logger.error(`[Task:${taskId}] Gemini Agent ${agentId} spawn error: ${err.message}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });
      this.emit('agent:error', { taskId, agentId, message: err.message } as AgentErrorEvent);
      void this.finalizeAgent(taskId, agentId);
    });
  }

  // ─── Stream-JSON 파싱 ─────────────────────────────────────────────────

  private handleClaudeLine(taskId: string, agentId: number, line: string): void {
    let event: ClaudeStreamEvent;
    try { event = JSON.parse(line) as ClaudeStreamEvent; }
    catch { return; }

    switch (event.type) {
      case 'assistant': {
        const e = event as ClaudeAssistantEvent;
        for (const block of e.message.content) {
          if (block.type === 'text' && block.text.trim()) {
            const prev = this.getAgentBuffer(taskId, agentId);
            this.updateAgentBuffer(taskId, agentId, { output: prev.output + block.text });
            this.emit('agent:output', { taskId, agentId, text: block.text } as AgentOutputEvent);
          }
          if (block.type === 'tool_use') {
            const toolLine = `\n⚙ ${block.name}(${JSON.stringify(block.input).slice(0, 120)})\n`;
            const prev = this.getAgentBuffer(taskId, agentId);
            this.updateAgentBuffer(taskId, agentId, { output: prev.output + toolLine });
            this.emit('agent:tool', { taskId, agentId, tool: block.name, input: block.input } as AgentToolEvent);
          }
        }
        break;
      }

      case 'result': {
        const e = event as ClaudeResultEvent;
        const status = e.is_error ? 'error' : 'completed';

        // close 핸들러가 error로 처리하지 않도록 result 수신 마킹
        this.resultReceivedSet.add(`${taskId}-${agentId}`);

        void this.agentRepo.update(agentId, { status });
        this.updateAgentBuffer(taskId, agentId, {
          status,
          durationMs: e.duration_ms,
          costUsd: e.total_cost_usd,
        });

        this.emit('agent:done', {
          taskId,
          agentId,
          result: e.result,
          isError: e.is_error,
          durationMs: e.duration_ms,
          costUsd: e.total_cost_usd,
        } as AgentDoneEvent);
        break;
      }
    }
  }

  // ─── 에이전트 완료 후처리 ─────────────────────────────────────────────

  /**
   * 에이전트 종료 시 순서대로:
   * 1. changelog 캡처 (worktree → diff → DB 저장)
   * 2. worktree 제거
   * 3. 태스크 완료 여부 체크
   */
  private async finalizeAgent(taskId: string, agentId: number): Promise<void> {
    const worktreeKey = `${taskId}-${agentId}`;
    const worktreeInfo = this.worktreeMap.get(worktreeKey);
    this.worktreeMap.delete(worktreeKey);

    if (worktreeInfo) {
      const { worktreePath } = worktreeInfo;

      const agent = await this.agentRepo.findOne({ where: { id: agentId } });
      if (agent?.startCommitHash) {
        await this.gitChangelogService.captureAndSave(
          taskId,
          agentId,
          worktreePath,
          agent.startCommitHash,
        );
      }
    }

    await this.checkTaskCompletion(taskId, agentId);
  }

  // ─── 완료 감지 ────────────────────────────────────────────────────────

  private async checkTaskCompletion(taskId: string, agentId: number): Promise<void> {
    const pending = this.pendingMap.get(taskId);
    if (!pending) return;
    pending.delete(agentId);

    await this.saveAgentMessage(taskId, agentId);

    if (pending.size > 0) return;
    this.pendingMap.delete(taskId);

    const [agents, taskEntity] = await Promise.all([
      this.agentRepo.find({ where: { taskId } }),
      this.taskRepo.findOne({ where: { id: taskId } }),
    ]);
    const hasError = agents.some((a) => a.status === 'error');
    const newStatus = hasError ? 'error' : 'completed';

    await this.taskRepo.update(taskId, { status: newStatus });

    this.emit('task:status', { taskId, status: newStatus, title: taskEntity?.title } as TaskStatusEvent);
    this.logger.log(`Task ${taskId} → ${newStatus}`);
  }

  private async saveAgentMessage(taskId: string, agentId: number): Promise<void> {
    const promptId = this.promptIdMap.get(`${taskId}-${agentId}`);
    if (!promptId) return;
    this.promptIdMap.delete(`${taskId}-${agentId}`);

    const buf = this.getAgentBuffer(taskId, agentId);
    if (!buf.output.trim()) return;

    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    const agentModel = agent?.agentType === 'gemini' ? AgentModel.GEMINI : AgentModel.CLAUDE;

    void this.conversationService.create({
      sessionId: taskId,
      promptId,
      content: buf.output.trim(),
      agentModel,
      type: ConversationType.AGENT_MESSAGE,
      agentId,
    });
  }

  /** 서버 재시작 후 버퍼가 비어있을 때 DB에서 로그 복원 */
  async getLogsFromDb(taskId: string): Promise<BufferedAgentLog[]> {
    const [conversations, agents] = await Promise.all([
      this.conversationService.findBySession(taskId),
      this.agentRepo.find({ where: { taskId } }),
    ]);

    const statusMap = new Map(agents.map((a) => [a.id, a.status]));

    const agentMessages = conversations.filter(
      (c) => c.type === ConversationType.AGENT_MESSAGE && c.agentId != null,
    );

    const byAgent = new Map<number, string>();
    for (const msg of agentMessages) {
      const id = msg.agentId!;
      byAgent.set(id, (byAgent.get(id) ?? '') + msg.content);
    }

    return Array.from(byAgent.entries()).map(([agentId, output]) => ({
      agentId,
      status: statusMap.get(agentId) ?? 'completed',
      output,
    }));
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

  private resolveClaude(): string {
    const candidates = [
      (): string => execSync('which claude', { encoding: 'utf8', timeout: 2000 }).trim(),
      (): string => {
        const home = process.env.HOME ?? '';
        const nvmDefault = `${home}/.nvm/versions/node/${process.version}/bin/claude`;
        if (fs.existsSync(nvmDefault)) return nvmDefault;
        throw new Error('not found');
      },
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

  private resolveGemini(): string {
    const candidates = [
      (): string => execSync('which gemini', { encoding: 'utf8', timeout: 2000 }).trim(),
      (): string => {
        const home = process.env.HOME ?? '';
        const nvmDefault = `${home}/.nvm/versions/node/${process.version}/bin/gemini`;
        if (fs.existsSync(nvmDefault)) return nvmDefault;
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
      try {
        const p = fn();
        if (p) return p;
      } catch {}
    }

    this.logger.warn('gemini 바이너리 경로를 자동 탐지하지 못했습니다. "gemini"로 폴백합니다.');
    return 'gemini';
  }

  private resolveCodex(): string {
    const candidates = [
      (): string => execSync('which codex', { encoding: 'utf8', timeout: 2000 }).trim(),
      (): string => {
        const home = process.env.HOME ?? '';
        const nvmDefault = `${home}/.nvm/versions/node/${process.version}/bin/codex`;
        if (fs.existsSync(nvmDefault)) return nvmDefault;
        throw new Error('not found');
      },
      (): string => {
        const npmBin = execSync('npm bin -g', { encoding: 'utf8', timeout: 2000 }).trim();
        const p = `${npmBin}/codex`;
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

    this.logger.warn('codex 바이너리 경로를 자동 탐지하지 못했습니다. "codex"로 폴백합니다.');
    return 'codex';
  }

  private resolveWorkingDir(workingDir: string | null): string {
    if (!workingDir) return process.cwd();
    if (fs.existsSync(workingDir)) return workingDir;

    this.logger.warn(`workingDir "${workingDir}" 이(가) 존재하지 않습니다. 서버 CWD로 폴백합니다.`);
    return process.cwd();
  }
}
