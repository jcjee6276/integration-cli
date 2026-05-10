import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  claudeSessionId!: string | null;

  @Column({ type: 'text', default: 'idle' })
  status!: string;

  @Column({ type: 'text' })
  workingDirectory!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastActivity!: Date;
}
