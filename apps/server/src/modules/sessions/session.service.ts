import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SessionEntity } from '../../database/entities/session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly repo: Repository<SessionEntity>,
  ) {}

  /** 전체 세션 목록 (최신순), agentType 필터 옵션 */
  findAll(agentType?: string): Promise<SessionEntity[]> {
    return this.repo.find({
      where: agentType ? { agentType } : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  /** 단건 조회 */
  async findOne(sessionId: string): Promise<SessionEntity> {
    const entity = await this.repo.findOne({ where: { sessionId } });
    if (!entity) throw new NotFoundException(`Session ${sessionId} not found`);
    return entity;
  }

  /** 타이틀 업데이트 */
  async updateTitle(sessionId: string, title: string): Promise<SessionEntity> {
    const entity = await this.findOne(sessionId);
    entity.title = title;
    return this.repo.save(entity);
  }

  /** 세션 삭제 */
  async deleteSession(sessionId: string): Promise<void> {
    const entity = await this.findOne(sessionId);
    await this.repo.remove(entity);
  }
}
