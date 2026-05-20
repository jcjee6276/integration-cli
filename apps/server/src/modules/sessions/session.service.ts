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

  /** 전체 세션 목록 (최신순) */
  findAll(): Promise<SessionEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  /** 단건 조회 */
  async findOne(sessionId: string): Promise<SessionEntity> {
    const entity = await this.repo.findOne({ where: { sessionId } });
    if (!entity) throw new NotFoundException(`Session ${sessionId} not found`);
    return entity;
  }
}
