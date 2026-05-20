import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AgentModel, ConversationType } from '../../modules/conversations/enums/conversation.enum';

@Entity('conversations')
export class ConversationEntity {
  /** 대화 고유 ID (UUID, PK) */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 세션 FK (sessions.session_id) */
  @Column({ type: 'text', name: 'session_id' })
  sessionId!: string;

  /** 프롬프트 ID — user_message / agent_message 1:1 매핑 키 */
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
