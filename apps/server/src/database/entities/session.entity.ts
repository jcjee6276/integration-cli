import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', default: 'claude' })
  agentType!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
