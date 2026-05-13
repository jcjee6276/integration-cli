import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AgentModel, ConversationType } from '../../modules/conversations/enums/conversation.enum';

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

  /** 에이전트 모델 (claude | chatgpt | gemini | opencode | grok) */
  @Column({ type: 'simple-enum', enum: AgentModel, name: 'agent_model' })
  agentModel!: AgentModel;

  /** 메시지 타입 (user_message | agent_message) */
  @Column({ type: 'simple-enum', enum: ConversationType })
  type!: ConversationType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
