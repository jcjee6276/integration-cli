import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  /** 세션 고유 ID (UUID, PK) */
  @PrimaryGeneratedColumn('uuid', { name: 'session_id' })
  sessionId!: string;

  /** 세션 제목 */
  @Column({ type: 'text' })
  title!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
