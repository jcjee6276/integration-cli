import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskRequirementEntity } from '../../database/entities/task-requirement.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { ClaudePtyManager } from '../agents/claude/claude-pty.manager';
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
    private readonly ptyManager: ClaudePtyManager,
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

    const workingDir = task.workingDir ?? process.cwd();
    const reqList = task.requirements
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((r, i) => `${i + 1}. ${r.content}`)
      .join('\n');

    for (const agent of task.agents) {
      const roleLabel = agent.role === 'other' && agent.customRole ? agent.customRole : agent.role;
      const prompt = [
        `[Task] ${task.title}`,
        reqList ? `\n[Requirements]\n${reqList}` : '',
        `\n[Your Role] ${roleLabel}`,
        '\n작업을 시작해주세요.',
      ].join('');

      const session = this.ptyManager.createSession(workingDir);
      this.ptyManager.sendMessage(session.id, prompt);

      await this.agentRepo.update(agent.id, {
        claudeSessionId: session.id,
        status: 'running',
      });
    }

    await this.taskRepo.update(id, { status: 'running' });
    return this.findOne(id);
  }

  // ─── 중지 ────────────────────────────────────────────────────────────

  async stop(id: string): Promise<TaskEntity> {
    const task = await this.findOne(id);

    for (const agent of task.agents) {
      if (agent.claudeSessionId) {
        try { this.ptyManager.terminateSession(agent.claudeSessionId); } catch {}
      }
      await this.agentRepo.update(agent.id, { claudeSessionId: null, status: 'stopped' });
    }

    await this.taskRepo.update(id, { status: 'stopped' });
    return this.findOne(id);
  }

  // ─── 조회 ────────────────────────────────────────────────────────────

  findAll(): Promise<TaskEntity[]> {
    return this.taskRepo.find({ relations: ['requirements', 'agents'], order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id }, relations: ['requirements', 'agents'] });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string): Promise<void> {
    await this.taskRepo.delete(id);
  }
}
