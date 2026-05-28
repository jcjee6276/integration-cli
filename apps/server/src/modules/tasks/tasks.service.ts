import * as fs from 'fs';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskAgentRunEntity } from '../../database/entities/task-agent-run.entity';
import { TaskRequirementEntity } from '../../database/entities/task-requirement.entity';
import { TaskRunEntity } from '../../database/entities/task-run.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { GitChangelogService } from '../changelog/changelog.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { TaskExecutionService } from './task-execution.service';

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

  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    const id = uuidv4();
    const task = this.taskRepo.create({
      id,
      title: dto.title,
      workingDir: dto.workingDir ?? null,
      status: 'pending',
    });
    await this.taskRepo.save(task);

    if (dto.requirements?.length) {
      await this.requirementRepo.save(
        dto.requirements.map((r, i) =>
          this.requirementRepo.create({
            taskId: id,
            content: r.content,
            orderIndex: r.orderIndex ?? i,
            status: 'pending',
          }),
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
            this.requirementRepo.create({
              taskId: id,
              content: r.content,
              orderIndex: r.orderIndex ?? i,
              status: 'pending',
            }),
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

  async execute(id: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    if (task.status === 'running') return task;

    if (task.status !== 'pending') {
      await this.resetTaskForRun(task);
    }

    const version = await this.getNextRunVersion(id);
    const run = await this.createRun(id, version, null);
    const executableTask = task.status === 'pending' ? task : await this.findOne(id);
    await this.spawnWithRun(executableTask, undefined, run.id);
    return this.findOne(id);
  }

  async rerun(id: string, supplementNote?: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    if (task.status === 'running') return task;

    await this.resetTaskForRun(task);
    const nextVersion = await this.getNextRunVersion(id);
    const run = await this.createRun(id, nextVersion, supplementNote ?? null);

    const refreshed = await this.findOne(id);
    await this.spawnWithRun(refreshed, supplementNote, run.id);
    return this.findOne(id);
  }

  async rerunAgent(id: string, agentId: number, supplementNote?: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    if (task.status === 'running') return task;

    const agent = task.agents.find((a) => a.id === agentId);
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);

    await this.agentRepo.update(agent.id, { status: 'pending', claudeSessionId: null });
    await this.taskRepo.update(task.id, { status: 'pending' });

    const nextVersion = await this.getNextRunVersion(id);
    const run = await this.createRun(id, nextVersion, supplementNote ?? null);
    const agentOnlyTask = {
      ...task,
      status: 'pending',
      agents: [{ ...agent, status: 'pending', claudeSessionId: null }],
    } as TaskEntity;

    await this.spawnWithRun(agentOnlyTask, supplementNote, run.id);
    return this.findOne(id);
  }

  async stop(id: string): Promise<TaskEntity> {
    const task = await this.findOne(id);
    await this.executionService.stopTask(task);

    await this.runRepo.update(
      { taskId: id, status: 'running' },
      { status: 'stopped', completedAt: new Date() },
    );

    return this.findOne(id);
  }

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

    const workingDir = this.resolveWorkingDir(task.workingDir);
    const storedPatchResult = await this.gitChangelogService.mergeAllFromChangelog(taskId, agentId, workingDir);
    if (storedPatchResult.success) return storedPatchResult;
    if (!agent.worktreePath) return { success: false, message: 'worktree가 존재하지 않습니다.' };

    return this.gitChangelogService.mergeAll(agent.worktreePath, workingDir);
  }

  async mergeAgentFile(taskId: string, agentId: number, filePath: string): Promise<{ success: boolean; message: string }> {
    const [task, agent] = await Promise.all([
      this.findOne(taskId),
      this.agentRepo.findOne({ where: { id: agentId, taskId } }),
    ]);
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);

    const workingDir = this.resolveWorkingDir(task.workingDir);
    const storedPatchResult = await this.gitChangelogService.mergeFileFromChangelog(taskId, agentId, workingDir, filePath);
    if (storedPatchResult.success) return storedPatchResult;
    if (!agent.worktreePath) return { success: false, message: 'worktree가 존재하지 않습니다.' };

    await this.assertFileBelongsToAgentChangelog(taskId, agentId, filePath);
    return this.gitChangelogService.mergeFile(agent.worktreePath, workingDir, filePath);
  }

  private async assertFileBelongsToAgentChangelog(taskId: string, agentId: number, filePath: string): Promise<void> {
    try {
      const changelogs = await this.gitChangelogService.getByTask(taskId);
      const agentChangelog = changelogs.find((entry) => entry.agentId === agentId);
      const hasFile = agentChangelog?.files.some((file) => file.filePath === filePath) ?? false;

      if (!hasFile) {
        throw new BadRequestException('변경 목록에 없는 파일은 병합할 수 없습니다.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('변경 목록을 확인할 수 없습니다.');
    }
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

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id }, relations: ['requirements', 'agents'] });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string): Promise<void> {
    await this.taskRepo.delete(id);
  }

  private async resetTaskForRun(task: TaskEntity): Promise<void> {
    for (const agent of task.agents) {
      await this.agentRepo.update(agent.id, { status: 'pending', claudeSessionId: null });
    }
    await this.taskRepo.update(task.id, { status: 'pending' });
  }

  private async getNextRunVersion(taskId: string): Promise<number> {
    const lastRun = await this.runRepo.findOne({
      where: { taskId },
      order: { version: 'DESC' },
    });
    return (lastRun?.version ?? 0) + 1;
  }

  private async spawnWithRun(task: TaskEntity, supplementNote: string | undefined, runId: number): Promise<void> {
    try {
      await this.executionService.spawnTask(task, supplementNote, runId);
    } catch (err) {
      await Promise.all([
        this.runRepo.update(runId, { status: 'error', completedAt: new Date() }),
        this.taskRepo.update(task.id, { status: 'error' }),
      ]);
      throw err;
    }
  }

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
