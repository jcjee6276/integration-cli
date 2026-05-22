import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

@Entity('agent_changelogs')
export class AgentChangelogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  taskId!: string;

  @Column('integer')
  agentId!: number;

  @Column('integer', { nullable: true })
  runId!: number | null;

  @Column('text')
  filePath!: string;

  @Column('text')
  changeType!: ChangeType;

  @Column('text', { nullable: true })
  patch!: string | null;

  @Column('integer', { default: 0 })
  additions!: number;

  @Column('integer', { default: 0 })
  deletions!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
