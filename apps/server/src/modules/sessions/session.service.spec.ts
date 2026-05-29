import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SessionEntity } from '../../database/entities/session.entity';
import { SessionService } from './session.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
});

describe('SessionService', () => {
  let service: SessionService;
  let repo: ReturnType<typeof mockRepo>;

  const baseSession: SessionEntity = {
    sessionId: 'sess-uuid-1',
    agentType: 'claude',
    title: 'Test Session',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: getRepositoryToken(SessionEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(SessionService);
    repo = module.get(getRepositoryToken(SessionEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('전체 세션 목록을 최신순으로 반환한다', async () => {
      repo.find.mockResolvedValue([baseSession]);

      const result = await service.findAll();

      expect(result).toEqual([baseSession]);
      expect(repo.find).toHaveBeenCalledWith({
        where: undefined,
        order: { createdAt: 'DESC' },
      });
    });

    it('agentType 필터로 세션을 조회한다', async () => {
      repo.find.mockResolvedValue([baseSession]);

      const result = await service.findAll('claude');

      expect(result).toEqual([baseSession]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { agentType: 'claude' },
        order: { createdAt: 'DESC' },
      });
    });

    it('gemini agentType 필터를 지원한다', async () => {
      const geminiSession = { ...baseSession, agentType: 'gemini' };
      repo.find.mockResolvedValue([geminiSession]);

      const result = await service.findAll('gemini');

      expect(result).toEqual([geminiSession]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { agentType: 'gemini' },
        order: { createdAt: 'DESC' },
      });
    });

    it('결과가 없으면 빈 배열을 반환한다', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('sessionId로 세션을 조회한다', async () => {
      repo.findOne.mockResolvedValue(baseSession);

      const result = await service.findOne('sess-uuid-1');

      expect(result).toBe(baseSession);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { sessionId: 'sess-uuid-1' } });
    });

    it('존재하지 않는 sessionId는 NotFoundException을 던진다', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('not-exist')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('not-exist')).rejects.toThrow('Session not-exist not found');
    });
  });
});
