import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TaskEntity } from './task.entity';

@Entity('task_requirements')
export class TaskRequirementEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  taskId!: string;

  @ManyToOne(() => TaskEntity, (t) => t.requirements, { onDelete: 'CASCADE' })
  task!: TaskEntity;

  @Column('text')
  content!: string;

  @Column('text', { default: 'pending' })
  status!: string;

  @Column('integer', { default: 0 })
  orderIndex!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
