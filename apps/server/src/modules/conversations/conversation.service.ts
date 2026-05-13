import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConversationEntity } from '../../database/entities/conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly repo: Repository<ConversationEntity>,
  ) {}

  /** 대화 메시지 저장 */
  create(dto: CreateConversationDto): Promise<ConversationEntity> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  /** 특정 세션의 전체 대화 조회 (생성 순) */
  findBySession(sessionId: string): Promise<ConversationEntity[]> {
    return this.repo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /** 단건 조회 */
  async findOne(id: string): Promise<ConversationEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Conversation ${id} not found`);
    return entity;
  }

  /** 단건 삭제 */
  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }

  /** 세션 전체 삭제 */
  async removeBySession(sessionId: string): Promise<void> {
    await this.repo.delete({ sessionId });
  }
}
