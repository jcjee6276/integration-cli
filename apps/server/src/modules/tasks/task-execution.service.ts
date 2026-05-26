import { execSync, spawn, type ChildProcess } from 'child_process';

const IS_WIN = process.platform === 'win32';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import * as fs from 'fs';

import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskAgentRunEntity } from '../../database/entities/task-agent-run.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { TaskRunEntity } from '../../database/entities/task-run.entity';
import { GeminiAuthManager } from '../agents/gemini/gemini-auth.manager';
import { ConversationService } from '../conversations/conversation.service';
import { AgentModel, ConversationType } from '../conversations/enums/conversation.enum';
import { GitChangelogService } from '../changelog/changelog.service';
import { HarnessService } from '../harness/harness.service';
import type { HarnessRole } from '../harness/harness.service';
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
  /** `${taskId}-${agentId}` → runId */
  private readonly runIdMap = new Map<string, number>();
  /** taskId → runId (태스크 단위 run 추적) */
  private readonly taskRunIdMap = new Map<string, number>();
  /** `${taskId}-${agentId}` → 실행 중인 child process */
  private readonly processMap = new Map<string, ChildProcess>();
  /** 사용자가 중지를 요청한 에이전트 키 */
  private readonly stoppingAgentSet = new Set<string>();
  private isShuttingDown = false;

  constructor(
    @InjectRepository(TaskAgentEntity)
    private readonly agentRepo: Repository<TaskAgentEntity>,
    @InjectRepository(TaskAgentRunEntity)
    private readonly agentRunRepo: Repository<TaskAgentRunEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskRunEntity)
    private readonly runRepo: Repository<TaskRunEntity>,
    private readonly geminiAuthManager: GeminiAuthManager,
    private readonly conversationService: ConversationService,
    private readonly gitChangelogService: GitChangelogService,
    private readonly harnessService: HarnessService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.claudeBin = this.resolveClaude();
    this.logger.log(`claude 경로: ${this.claudeBin}`);
    this.geminiBin = this.resolveGemini();
    this.logger.log(`gemini 경로: ${this.geminiBin}`);
    this.codexBin = this.resolveCodex();
    this.logger.log(`codex 경로: ${this.codexBin}`);
    await this.recoverStuckTasks();
  }

  /** 서버 재시작 시 running 상태로 남은 task/agent를 stopped으로 복구 */
  private async recoverStuckTasks(): Promise<void> {
    const [stuckAgents, stuckTasks, stuckRuns] = await Promise.all([
      this.agentRepo.find({ where: { status: 'running' } }),
      this.taskRepo.find({ where: { status: 'running' } }),
      this.runRepo.find({ where: { status: 'running' } }),
    ]);

    if (stuckAgents.length === 0 && stuckTasks.length === 0 && stuckRuns.length === 0) return;

    const taskIds = new Set<string>([
      ...stuckAgents.map((a) => a.taskId),
      ...stuckTasks.map((t) => t.id),
      ...stuckRuns.map((r) => r.taskId),
    ]);
    const now = new Date();

    if (stuckAgents.length > 0) {
      await this.agentRepo.update(
        stuckAgents.map((a) => a.id),
        { status: 'stopped' },
      );
    }

    // 연결된 task_agent_runs도 stopped 처리
    const stuckAgentIds = stuckAgents.map((a) => a.id);
    if (stuckAgentIds.length > 0) {
      const stuckAgentRuns = await this.agentRunRepo.find({
        where: stuckAgentIds.map((id) => ({ agentId: id, status: 'running' })),
      });
      if (stuckAgentRuns.length > 0) {
        await this.agentRunRepo.update(
          stuckAgentRuns.map((r) => r.id),
          { status: 'stopped' },
        );
      }
    }

    if (taskIds.size > 0) {
      const ids = Array.from(taskIds);
      await Promise.all([
        this.taskRepo.update({ id: In(ids), status: 'running' }, { status: 'stopped' }),
        this.runRepo.update(
          { taskId: In(ids), status: 'running' },
          { status: 'stopped', completedAt: now },
        ),
      ]);
    }

    this.logger.warn(
      `서버 재시작 복구: ${stuckAgents.length}개 에이전트, ${taskIds.size}개 작업을 stopped으로 변경`,
    );
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    for (const [key, proc] of this.processMap.entries()) {
      this.stoppingAgentSet.add(key);
      try {
        proc.kill('SIGTERM');
      } catch (err) {
        this.logger.warn(`프로세스 종료 실패 (${key}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.logBuffer.clear();
    this.pendingMap.clear();
    this.promptIdMap.clear();
    this.worktreeMap.clear();
    this.resultReceivedSet.clear();
    this.runIdMap.clear();
    this.taskRunIdMap.clear();
    this.processMap.clear();
    this.stoppingAgentSet.clear();
  }

  // ─── 공개 API ─────────────────────────────────────────────────────────

  async spawnTask(task: TaskEntity, supplementNote?: string, runId?: number): Promise<void> {
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

    if (runId != null) {
      this.taskRunIdMap.set(task.id, runId);
    }

    for (const agent of task.agents) {
      const roleLabel = agent.role === 'other' && agent.customRole ? agent.customRole : agent.role;

      // 공통 하네스 + 역할별 하네스 로드
      const commonHarness = this.harnessService.findOne('common');
      const roleHarness = this.harnessService.findOne(agent.role as HarnessRole);
      const harnessSection = [
        commonHarness?.content?.trim() ? `[공통 하네스]\n${commonHarness.content.trim()}` : '',
        roleHarness?.content?.trim()   ? `[${roleLabel} 하네스]\n${roleHarness.content.trim()}` : '',
      ].filter(Boolean).join('\n\n');

      const prompt = [
        harnessSection ? `${harnessSection}\n\n` : '',
        `당신은 ${roleLabel} 역할의 AI 에이전트입니다.`,
        `\n\n[작업 목표]\n${task.title}`,
        reqList ? `\n\n[요구사항]\n${reqList}` : '',
        supplementNote ? `\n\n[이전 결과 보완 사항]\n${supplementNote}` : '',
        `\n\n위 작업을 수행해주세요.`,
      ].join('');

      await this.agentRepo.update(agent.id, { status: 'running' });
      this.initAgentBuffer(task.id, agent.id);

      // runId 맵 등록
      if (runId != null) {
        this.runIdMap.set(`${task.id}-${agent.id}`, runId);

        // TaskAgentRunEntity 생성
        const agentRun = this.agentRunRepo.create({
          runId,
          agentId: agent.id,
          status: 'running',
        });
        const savedAgentRun = await this.agentRunRepo.save(agentRun);

        // agentRunId도 맵에 저장 (완료 시 업데이트 용)
        this.runIdMap.set(`agentRunId-${task.id}-${agent.id}`, savedAgentRun.id);
      }

      const promptId = uuidv4();
      this.promptIdMap.set(`${task.id}-${agent.id}`, promptId);
      await this.conversationService.create({
        sessionId: task.id,
        promptId,
        content: prompt,
        agentModel: this.getAgentModel(agent.agentType),
        type: ConversationType.USER_MESSAGE,
        agentId: agent.id,
        runId: runId ?? null,
      });

      // git repo인 경우 에이전트별 worktree 생성
      let agentWorkDir = workingDir;
      if (isGitRepo) {
        try {
          const { worktreePath, branchName, agentWorkDir: worktreeAgentDir } = this.gitChangelogService.createWorktree(workingDir, agent.agentType);
          const startCommitHash = this.gitChangelogService.getCurrentHead(workingDir);
          await this.agentRepo.update(agent.id, { worktreePath, startCommitHash });

          // TaskAgentRunEntity에도 worktree 정보 저장
          if (runId != null) {
            const agentRunId = this.runIdMap.get(`agentRunId-${task.id}-${agent.id}`);
            if (agentRunId != null) {
              await this.agentRunRepo.update(agentRunId as number, { worktreePath, startCommitHash });
            }
          }

          this.worktreeMap.set(`${task.id}-${agent.id}`, { worktreePath, branchName, mainRepoDir: workingDir });
          agentWorkDir = worktreeAgentDir;
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
      const isRunning = agent.status === 'running' || this.processMap.has(this.getAgentKey(task.id, agent.id));
      if (isRunning) {
        this.requestAgentStop(task.id, agent.id);
        await this.agentRepo.update(agent.id, { status: 'stopped' });
        this.updateAgentBuffer(task.id, agent.id, { status: 'stopped' });

        // TaskAgentRunEntity 상태 업데이트
        await this.updateAgentRunStatus(task.id, agent.id, 'stopped');

        const ev: AgentErrorEvent = { taskId: task.id, agentId: agent.id, message: '수동으로 중지됐습니다.' };
        this.emit('agent:error', ev);
      }
    }

    await this.taskRepo.update(task.id, { status: 'stopped' });

    const taskRunId = this.taskRunIdMap.get(task.id);
    if (taskRunId != null) {
      await this.runRepo.update(taskRunId, { status: 'stopped', completedAt: new Date() });
      this.taskRunIdMap.delete(task.id);
    }

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
    this.registerProcess(taskId, agentId, proc);

    let buffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      if (this.isAgentStopping(taskId, agentId)) return;
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.handleClaudeLine(taskId, agentId, trimmed);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      if (this.isAgentStopping(taskId, agentId)) return;
      this.logger.warn(`[Task:${taskId}] Claude Agent ${agentId} stderr: ${chunk.toString().slice(0, 200)}`);
    });

    proc.on('close', (exitCode) => {
      if (this.isAgentStopping(taskId, agentId)) {
        this.cleanupAgentRuntime(taskId, agentId);
        return;
      }

      if (buffer.trim()) this.handleClaudeLine(taskId, agentId, buffer.trim());

      const key = `${taskId}-${agentId}`;
      const hadResult = this.resultReceivedSet.delete(key);

      if (!hadResult) {
        this.logger.warn(`[Task:${taskId}] Claude Agent ${agentId} exited (code: ${exitCode}) without result`);
        void this.agentRepo.update(agentId, { status: 'error' });
        this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: `종료 코드: ${exitCode}` });
        void this.updateAgentRunStatus(taskId, agentId, 'error');
        this.emit('agent:error', { taskId, agentId, message: `프로세스가 코드 ${exitCode}로 종료됐습니다.` } as AgentErrorEvent);
      }

      void this.finalizeAgent(taskId, agentId);
    });

    proc.on('error', (err) => {
      if (this.isAgentStopping(taskId, agentId)) return;
      this.logger.error(`[Task:${taskId}] Claude Agent ${agentId} spawn error: ${err.message}`);
      this.resultReceivedSet.delete(`${taskId}-${agentId}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });
      void this.updateAgentRunStatus(taskId, agentId, 'error');
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
        '-c', 'approval_policy=never',
        '-c', 'sandbox_mode=danger-full-access',
        prompt,
      ],
      {
        cwd: workingDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: IS_WIN,
      },
    );
    this.registerProcess(taskId, agentId, proc);

    let output = '';

    const handleChunk = (chunk: Buffer): void => {
      if (this.isAgentStopping(taskId, agentId)) return;
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
      if (this.isAgentStopping(taskId, agentId)) {
        this.cleanupAgentRuntime(taskId, agentId);
        return;
      }

      const isError = (exitCode ?? 0) !== 0;
      const status = isError ? 'error' : 'completed';

      void this.agentRepo.update(agentId, { status });
      this.updateAgentBuffer(taskId, agentId, { status });
      void this.updateAgentRunStatus(taskId, agentId, status, 0, 0);

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
      if (this.isAgentStopping(taskId, agentId)) return;
      this.logger.error(`[Task:${taskId}] Codex Agent ${agentId} spawn error: ${err.message}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });
      void this.updateAgentRunStatus(taskId, agentId, 'error');
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
    this.registerProcess(taskId, agentId, proc);

    let output = '';

    const handleChunk = (chunk: Buffer): void => {
      if (this.isAgentStopping(taskId, agentId)) return;
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
      if (this.isAgentStopping(taskId, agentId)) {
        this.cleanupAgentRuntime(taskId, agentId);
        return;
      }

      const isError = (exitCode ?? 0) !== 0;
      const status = isError ? 'error' : 'completed';

      void this.agentRepo.update(agentId, { status });
      this.updateAgentBuffer(taskId, agentId, { status });
      void this.updateAgentRunStatus(taskId, agentId, status, 0, 0);

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
      if (this.isAgentStopping(taskId, agentId)) return;
      this.logger.error(`[Task:${taskId}] Gemini Agent ${agentId} spawn error: ${err.message}`);
      void this.agentRepo.update(agentId, { status: 'error' });
      this.updateAgentBuffer(taskId, agentId, { status: 'error', errorMessage: err.message });
      void this.updateAgentRunStatus(taskId, agentId, 'error');
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

        this.resultReceivedSet.add(`${taskId}-${agentId}`);

        void this.agentRepo.update(agentId, { status });
        this.updateAgentBuffer(taskId, agentId, {
          status,
          durationMs: e.duration_ms,
          costUsd: e.total_cost_usd,
        });
        void this.updateAgentRunStatus(taskId, agentId, status, e.duration_ms, e.total_cost_usd);

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

  private async finalizeAgent(taskId: string, agentId: number): Promise<void> {
    try {
      const worktreeKey = this.getAgentKey(taskId, agentId);
      const worktreeInfo = this.worktreeMap.get(worktreeKey);
      this.worktreeMap.delete(worktreeKey);

      if (worktreeInfo) {
        const { worktreePath } = worktreeInfo;

        const [agent, task] = await Promise.all([
          this.agentRepo.findOne({ where: { id: agentId } }),
          this.taskRepo.findOne({ where: { id: taskId } }),
        ]);

        if (agent?.startCommitHash) {
          const roleLabel = agent.role === 'other' && agent.customRole
            ? agent.customRole
            : agent.role;
          const commitMessage = `feat(${agent.agentType}/${roleLabel}): ${task?.title ?? taskId}`;

          const runId = this.runIdMap.get(`${taskId}-${agentId}`);
          await this.gitChangelogService.captureAndSave(
            taskId,
            agentId,
            worktreePath,
            agent.startCommitHash,
            commitMessage,
            runId,
          );
        }
      }

      await this.checkTaskCompletion(taskId, agentId);
    } finally {
      this.cleanupAgentRuntime(taskId, agentId);
    }
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

    // TaskRunEntity 완료 처리
    const taskRunId = this.taskRunIdMap.get(taskId);
    if (taskRunId != null) {
      await this.runRepo.update(taskRunId, { status: newStatus, completedAt: new Date() });
      this.taskRunIdMap.delete(taskId);
    }

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
    const agentModel = this.getAgentModel(agent?.agentType ?? 'claude');

    const runId = this.runIdMap.get(`${taskId}-${agentId}`);

    try {
      await this.conversationService.create({
        sessionId: taskId,
        promptId,
        content: buf.output.trim(),
        agentModel,
        type: ConversationType.AGENT_MESSAGE,
        agentId,
        runId: runId ?? null,
      });
    } catch (err) {
      this.logger.error(`Agent ${agentId} 메시지 저장 실패: ${err}`);
    }
  }

  /** 서버 재시작 후 버퍼가 비어있을 때 DB에서 로그 복원 — 최신 run 기준 */
  async getLogsFromDb(taskId: string): Promise<BufferedAgentLog[]> {
    const agents = await this.agentRepo.find({ where: { taskId } });
    if (!agents.length) return [];

    // 최신 run의 conversations만 조회
    const latestRun = await this.agentRunRepo.findOne({
      where: { agentId: agents[0].id },
      order: { runId: 'DESC' },
    });

    let conversations;
    if (latestRun?.runId != null) {
      conversations = await this.conversationService.findByRun(latestRun.runId);
    } else {
      // runId가 없는 레거시 데이터: sessionId로 조회
      conversations = await this.conversationService.findBySession(taskId);
    }

    const statusMap = new Map(agents.map((a) => [a.id, a.status]));

    const agentMessages = conversations.filter(
      (c) => c.type === ConversationType.AGENT_MESSAGE && c.agentId != null,
    );

    const byAgent = new Map<number, string>();
    for (const msg of agentMessages) {
      const id = Number(msg.agentId!);
      byAgent.set(id, (byAgent.get(id) ?? '') + msg.content);
    }

    return agents.map((agent) => ({
      agentId: agent.id,
      status: statusMap.get(agent.id) ?? 'stopped',
      output: byAgent.get(agent.id) ?? '',
    }));
  }

  // ─── TaskAgentRun 상태 업데이트 헬퍼 ─────────────────────────────────

  private async updateAgentRunStatus(
    taskId: string,
    agentId: number,
    status: string,
    durationMs?: number,
    costUsd?: number,
  ): Promise<void> {
    const agentRunId = this.runIdMap.get(`agentRunId-${taskId}-${agentId}`);
    if (agentRunId == null) return;
    await this.agentRunRepo.update(agentRunId as number, {
      status,
      ...(durationMs != null ? { durationMs } : {}),
      ...(costUsd != null ? { costUsd } : {}),
    });
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

  private getAgentKey(taskId: string, agentId: number): string {
    return `${taskId}-${agentId}`;
  }

  private getAgentModel(agentType: TaskAgentEntity['agentType']): AgentModel {
    if (agentType === 'gemini') return AgentModel.GEMINI;
    if (agentType === 'codex') return AgentModel.CODEX;
    if (agentType === 'opencode') return AgentModel.OPENCODE;
    return AgentModel.CLAUDE;
  }

  private registerProcess(taskId: string, agentId: number, proc: ChildProcess): void {
    this.processMap.set(this.getAgentKey(taskId, agentId), proc);
  }

  private isAgentStopping(taskId: string, agentId: number): boolean {
    return this.isShuttingDown || this.stoppingAgentSet.has(this.getAgentKey(taskId, agentId));
  }

  private requestAgentStop(taskId: string, agentId: number): void {
    const key = this.getAgentKey(taskId, agentId);
    const proc = this.processMap.get(key);
    if (!proc) return;

    this.stoppingAgentSet.add(key);
    try {
      proc.kill('SIGTERM');
      const forceKill = setTimeout(() => {
        if (!this.processMap.has(key)) return;
        try {
          proc.kill('SIGKILL');
        } catch (err) {
          this.logger.warn(`프로세스 강제 종료 실패 (${key}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }, 5000);
      forceKill.unref?.();
    } catch (err) {
      this.logger.warn(`프로세스 종료 실패 (${key}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private cleanupAgentRuntime(taskId: string, agentId: number): void {
    const key = this.getAgentKey(taskId, agentId);
    this.processMap.delete(key);
    this.stoppingAgentSet.delete(key);
    this.resultReceivedSet.delete(key);
    this.promptIdMap.delete(key);
    this.worktreeMap.delete(key);
    this.runIdMap.delete(key);
    this.runIdMap.delete(`agentRunId-${key}`);
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
    try {
      if (!workingDir) {
        return process.cwd();
      }
      if (!fs.existsSync(workingDir)) {
        throw new BadRequestException(`작업 디렉토리가 존재하지 않습니다: ${workingDir}`);
      }
      if (!fs.statSync(workingDir).isDirectory()) {
        throw new BadRequestException(`작업 디렉토리가 폴더가 아닙니다: ${workingDir}`);
      }
      return workingDir;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`작업 디렉토리를 확인할 수 없습니다: ${workingDir}`);
    }
  }

}
