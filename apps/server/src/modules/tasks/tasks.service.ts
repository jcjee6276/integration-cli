import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskRequirementEntity } from '../../database/entities/task-requirement.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import type { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TaskRequirementEntity)
    private readonly requirementRepo: Repository<TaskRequirementEntity>,
    @InjectRepository(TaskAgentEntity)
    private readonly agentRepo: Repository<TaskAgentEntity>,
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
      const reqs = dto.requirements.map((r, i) =>
        this.requirementRepo.create({
          taskId: id,
          content: r.content,
          orderIndex: r.orderIndex ?? i,
          status: 'pending',
        }),
      );
      await this.requirementRepo.save(reqs);
    }

    if (dto.agents?.length) {
      const agents = dto.agents.map((a) =>
        this.agentRepo.create({
          taskId: id,
          role: a.role as TaskAgentEntity['role'],
          customRole: a.customRole ?? null,
          status: 'pending',
        }),
      );
      await this.agentRepo.save(agents);
    }

    return this.findOne(id);
  }

  findAll(): Promise<TaskEntity[]> {
    return this.taskRepo.find({
      relations: ['requirements', 'agents'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['requirements', 'agents'],
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async remove(id: string): Promise<void> {
    await this.taskRepo.delete(id);
  }
}
