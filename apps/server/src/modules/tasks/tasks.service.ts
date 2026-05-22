import * as fs from 'fs';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskAgentRunEntity } from '../../database/entities/task-agent-run.entity';
import { TaskRequirementEntity } from '../../database/entities/task-requirement.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { TaskRunEntity } from '../../database/entities/task-run.entity';
import { GitChangelogService } from '../changelog/changelog.service';
import { TaskExecutionService } from './task-execution.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskRequirementEntity)
    private readonly requirementRepo: Repository<TaskRequirementEntity>,
    @InjectRepository(TaskAgentEntity)
    private readonly agentRepo: Repository<TaskAgentEntity>,
    @InjectRepository(TaskRunEntity)
    private readonly runRepo: Repository<TaskRunEntity>,
    @InjectRepository(TaskAgentRunEntity)
    private readonly agentRunRepo: Repository<TaskAgentRunEntity>,
    private readonly executionService: TaskExecutionService,
    private readonly gitChangelogService: GitChangelogService,
  ) {}

  // ─── 생성 ────────────────────────────────────────────────────────────

  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    const id = uuidv4();
    const task = this.taskRepo.create({ id, title: dto.title, workingDir: dto.workingDir ?? null, status: 'pending' });
    await this.taskRepo.save(task);

    if (dto.requirements?.length) {
      await this.requirementRepo.save(
        dto.requirements.map((r, i) =>
          this.requirementRepo.create({ taskId: id, content: r.content, orderIndex: r.orderIndex ?? i, status: 'pending' }),
        ),
      );
    }
    if (dto.agents?.length) {
      await this.agentRepo.save(
        dto.agents.map((a) =>
          this.agentRepo.create({
            taskId: id,
            agentType: (a.agentType ?? 'claude') as TaskAgentEntity['agentType'],
            role: a.role as TaskAgentEntity['role'],
            customRole: a.customRole ?? null,
            status: 'pending',
          }),
        ),
      );
    }
    return this.findOne(id);
  }

  // ─── 수정 ────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateTaskDto): Promise<TaskEntity> {
    const task = await this.findOne(id);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.workingDir !== undefined) task.workingDir = dto.workingDir ?? null;
    await this.taskRepo.save(task);

    if (dto.requirements !== undefined) {
      await this.requirementRepo.delete({ taskId: id });
      if (dto.requirements.length) {
        await this.requirementRepo.save(
          dto.requirements.map((r, i) =>
            this.requirementRepo.create({ taskId: id, content: r.content, orderIndex: r.orderIndex ?? i, status: 'pending' }),
          ),
        );
      }
    }
    if (dto.agents !== undefined) {
      await this.agentRepo.delete({ taskId: id });
      if (dto.agents.length) {
        await this.agentRepo.save(
          dto.agents.map((a) =>
            this.agentRepo.create({
              taskId: id,
              agentType: (a.agentType ?? 'claude') as TaskAgentEntity['agentType'],
              role: a.role as TaskAgentEntity['role'],
              customRole: a.customRole ?? null,
              status: 'pending',
            }),
          ),
        );
      }
    }
    return this.findOne(id);
  }

  // ─── 실행 ────────────────────────────────────────────────────────────

  async execute(id: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    if (task.status === 'running') return task;

    const run = await this.createRun(id, 1, null);
    await this.executionService.spawnTask(task, undefined, run.id);
    return this.findOne(id);
  }

  // ─── 재 실행 ─────────────────────────────────────────────────────────

  async rerun(id: string, supplementNote?: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    if (task.status === 'running') return task;

    // 에이전트 상태 초기화
    for (const agent of task.agents) {
      await this.agentRepo.update(agent.id, { status: 'pending', claudeSessionId: null });
    }
    await this.taskRepo.update(id, { status: 'pending' });

    // 다음 버전 번호 계산
    const lastRun = await this.runRepo.findOne({
      where: { taskId: id },
      order: { version: 'DESC' },
    });
    const nextVersion = (lastRun?.version ?? 0) + 1;

    const run = await this.createRun(id, nextVersion, supplementNote ?? null);

    const refreshed = await this.findOne(id);
    await this.executionService.spawnTask(refreshed, supplementNote, run.id);
    return this.findOne(id);
  }

  // ─── 중지 ────────────────────────────────────────────────────────────

  async stop(id: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    await this.executionService.stopTask(task);

    // 진행 중인 run을 stopped으로 업데이트
    await this.runRepo.update(
      { taskId: id, status: 'running' },
      { status: 'stopped', completedAt: new Date() },
    );

    return this.findOne(id);
  }

  // ─── 조회 ────────────────────────────────────────────────────────────

  findAll(): Promise<TaskEntity[]> {
    return this.taskRepo.find({
      where: { archived: false },
      relations: ['requirements', 'agents'],
      order: { createdAt: 'DESC' },
    });
  }

  async getRuns(taskId: string): Promise<TaskRunEntity[]> {
    return this.runRepo.find({
      where: { taskId },
      relations: ['agentRuns'],
      order: { version: 'DESC' },
    });
  }

  async archive(id: string): Promise<void> {
    await this.findOne(id);
    await this.taskRepo.update(id, { archived: true });
  }

  async mergeAgentAll(taskId: string, agentId: number): Promise<{ success: boolean; message: string }> {
    const [task, agent] = await Promise.all([
      this.findOne(taskId),
      this.agentRepo.findOne({ where: { id: agentId, taskId } }),
    ]);
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    if (!agent.worktreePath) return { success: false, message: 'worktree가 존재하지 않습니다.' };

    const workingDir = this.resolveWorkingDir(task.workingDir);
    return this.gitChangelogService.mergeAll(agent.worktreePath, workingDir);
  }

  async mergeAgentFile(taskId: string, agentId: number, filePath: string): Promise<{ success: boolean; message: string }> {
    const [task, agent] = await Promise.all([
      this.findOne(taskId),
      this.agentRepo.findOne({ where: { id: agentId, taskId } }),
    ]);
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    if (!agent.worktreePath) return { success: false, message: 'worktree가 존재하지 않습니다.' };

    const workingDir = this.resolveWorkingDir(task.workingDir);
    return this.gitChangelogService.mergeFile(agent.worktreePath, workingDir, filePath);
  }

  private resolveWorkingDir(workingDir: string | null): string {
    if (workingDir && fs.existsSync(workingDir)) return workingDir;
    return process.cwd();
  }

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id }, relations: ['requirements', 'agents'] });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string): Promise<void> {
    await this.taskRepo.delete(id);
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────────

  private async createRun(taskId: string, version: number, supplementNote: string | null): Promise<TaskRunEntity> {
    const run = this.runRepo.create({
      taskId,
      version,
      supplementNote,
      status: 'running',
    });
    return this.runRepo.save(run);
  }
}
