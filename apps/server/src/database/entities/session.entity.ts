import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ConversationEntity } from './conversation.entity';

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

  @OneToMany(() => ConversationEntity, (conversation) => conversation.session)
  conversations!: ConversationEntity[];
}
