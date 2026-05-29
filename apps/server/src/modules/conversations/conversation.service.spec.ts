import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ConversationEntity } from '../../database/entities/conversation.entity';
import { AgentModel, ConversationType } from './enums/conversation.enum';
import { ConversationService } from './conversation.service';

const mockRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })),
  save: jest.fn((e: any) => Promise.resolve(e)),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
});

describe('ConversationService', () => {
  let service: ConversationService;
  let repo: ReturnType<typeof mockRepo>;

  const baseConversation: ConversationEntity = {
    id: 'conv-uuid-1',
    sessionId: 'session-1',
    promptId: 'prompt-1',
    agentId: null,
    runId: null,
    content: '코드 분석해줘',
    agentModel: AgentModel.CLAUDE,
    type: ConversationType.USER_MESSAGE,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: getRepositoryToken(ConversationEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(ConversationService);
    repo = module.get(getRepositoryToken(ConversationEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('대화 메시지를 생성하고 저장한다', async () => {
      repo.save.mockResolvedValue(baseConversation);

      const dto = {
        sessionId: 'session-1',
        promptId: 'prompt-1',
        content: '코드 분석해줘',
        agentModel: AgentModel.CLAUDE,
        type: ConversationType.USER_MESSAGE,
      };
      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toBe(baseConversation);
    });

    it('agentId와 runId를 포함한 메시지를 생성한다', async () => {
      const withIds = { ...baseConversation, agentId: 5, runId: 2 };
      repo.save.mockResolvedValue(withIds);

      const dto = {
        sessionId: 'session-1',
        promptId: 'prompt-1',
        content: 'agent response',
        agentModel: AgentModel.CLAUDE,
        type: ConversationType.AGENT_MESSAGE,
        agentId: 5,
        runId: 2,
      };
      const result = await service.create(dto);

      expect(result.agentId).toBe(5);
      expect(result.runId).toBe(2);
    });
  });

  // ─── findBySession ───────────────────────────────────────────────────────

  describe('findBySession', () => {
    it('세션의 전체 대화를 생성 시간 오름차순으로 반환한다', async () => {
      repo.find.mockResolvedValue([baseConversation]);

      const result = await service.findBySession('session-1');

      expect(result).toEqual([baseConversation]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        order: { createdAt: 'ASC' },
      });
    });

    it('대화가 없으면 빈 배열을 반환한다', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findBySession('empty-session');

      expect(result).toEqual([]);
    });
  });

  // ─── findByRun ───────────────────────────────────────────────────────────

  describe('findByRun', () => {
    it('run의 대화를 생성 시간 오름차순으로 반환한다', async () => {
      const runConv = { ...baseConversation, runId: 3 };
      repo.find.mockResolvedValue([runConv]);

      const result = await service.findByRun(3);

      expect(result).toEqual([runConv]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { runId: 3 },
        order: { createdAt: 'ASC' },
      });
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('ID로 대화를 조회한다', async () => {
      repo.findOne.mockResolvedValue(baseConversation);

      const result = await service.findOne('conv-uuid-1');

      expect(result).toBe(baseConversation);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'conv-uuid-1' } });
    });

    it('존재하지 않는 ID는 NotFoundException을 던진다', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('대화를 조회 후 삭제한다', async () => {
      repo.findOne.mockResolvedValue(baseConversation);

      await service.remove('conv-uuid-1');

      expect(repo.findOne).toHaveBeenCalled();
      expect(repo.remove).toHaveBeenCalledWith(baseConversation);
    });

    it('존재하지 않는 ID는 NotFoundException을 던진다', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── removeBySession ─────────────────────────────────────────────────────

  describe('removeBySession', () => {
    it('세션의 전체 대화를 삭제한다', async () => {
      await service.removeBySession('session-1');

      expect(repo.delete).toHaveBeenCalledWith({ sessionId: 'session-1' });
    });
  });
});
