import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Claude CLI 프로세스 세션 추적용 엔티티 (내부 사용) */
@Entity('agent_sessions')
export class AgentSessionEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  claudeSessionId!: string | null;

  @Column({ type: 'text', default: 'idle' })
  status!: string;

  @Column({ type: 'text' })
  workingDirectory!: string;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'text', nullable: true })
  reasoning!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastActivity!: Date;
}
