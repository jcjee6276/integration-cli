import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TaskEntity } from './task.entity';

export type AgentRole = 'frontend' | 'backend' | 'doc' | 'operation' | 'other';

@Entity('task_agents')
export class TaskAgentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  taskId!: string;

  @ManyToOne(() => TaskEntity, (t) => t.agents, { onDelete: 'CASCADE' })
  task!: TaskEntity;

  @Column('text')
  role!: AgentRole;

  @Column('text', { nullable: true })
  customRole!: string | null;

  @Column('text', { nullable: true })
  claudeSessionId!: string | null;

  @Column('text', { default: 'pending' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
