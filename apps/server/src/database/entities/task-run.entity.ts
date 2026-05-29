import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TaskEntity } from './task.entity';
import { TaskAgentRunEntity } from './task-agent-run.entity';

@Entity('task_runs')
export class TaskRunEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  taskId!: string;

  @Column('integer')
  version!: number;

  @Column('text', { nullable: true })
  supplementNote!: string | null;

  @Column('text', { default: 'pending' })
  status!: string;

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  task!: TaskEntity;

  @OneToMany(() => TaskAgentRunEntity, (ar) => ar.run, { cascade: true })
  agentRuns!: TaskAgentRunEntity[];
}
