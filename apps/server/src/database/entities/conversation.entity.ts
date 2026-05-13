import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('conversations')
export class ConversationEntity {
  /** 전체 세션 ID (자동 생성 UUID, 기본 키) */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Agent 세션 ID */
  @Column({ type: 'text', name: 'agent_session_id' })
  agentSessionId!: string;

  /** 프롬프트 ID */
  @Column({ type: 'text', name: 'prompt_id' })
  promptId!: string;

  /** 메시지 내용 */
  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
