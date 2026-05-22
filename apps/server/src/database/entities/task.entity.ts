import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TaskAgentEntity } from './task-agent.entity';
import { TaskRequirementEntity } from './task-requirement.entity';

@Entity('tasks')
export class TaskEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  title!: string;

  @Column('text', { default: 'pending' })
  status!: string;

  @Column('text', { nullable: true })
  workingDir!: string | null;

  @Column('text', { nullable: true })
  claudeSessionId!: string | null;

  @Column('boolean', { default: false })
  archived!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => TaskRequirementEntity, (r) => r.task, { cascade: true })
  requirements!: TaskRequirementEntity[];

  @OneToMany(() => TaskAgentEntity, (a) => a.task, { cascade: true })
  agents!: TaskAgentEntity[];
}
