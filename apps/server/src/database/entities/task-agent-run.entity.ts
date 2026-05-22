import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TaskAgentEntity } from './task-agent.entity';
import { TaskRunEntity } from './task-run.entity';

@Entity('task_agent_runs')
export class TaskAgentRunEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  runId!: number;

  @Column('integer')
  agentId!: number;

  @Column('text', { default: 'pending' })
  status!: string;

  @Column('text', { nullable: true })
  worktreePath!: string | null;

  @Column('text', { nullable: true })
  startCommitHash!: string | null;

  @Column('real', { nullable: true })
  durationMs!: number | null;

  @Column('real', { nullable: true })
  costUsd!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => TaskRunEntity, (r) => r.agentRuns, { onDelete: 'CASCADE' })
  run!: TaskRunEntity;

  @ManyToOne(() => TaskAgentEntity, { onDelete: 'CASCADE' })
  agent!: TaskAgentEntity;
}
