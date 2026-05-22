import { Test, TestingModule } from '@nestjs/testing';

import { ConversationEntity } from '../../database/entities/conversation.entity';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { AgentModel, ConversationType } from './enums/conversation.enum';

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

describe('ConversationController', () => {
  let controller: ConversationController;
  let service: jest.Mocked<ConversationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: {
            create: jest.fn(),
            findBySession: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            removeBySession: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ConversationController);
    service = module.get(ConversationService) as jest.Mocked<ConversationService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('service.create를 호출하고 결과를 반환한다', async () => {
      service.create.mockResolvedValue(baseConversation);

      const dto = {
        sessionId: 'session-1',
        promptId: 'prompt-1',
        content: '코드 분석해줘',
        agentModel: AgentModel.CLAUDE,
        type: ConversationType.USER_MESSAGE,
      };
      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(baseConversation);
    });
  });

  describe('findBySession', () => {
    it('service.findBySession을 sessionId로 호출한다', async () => {
      service.findBySession.mockResolvedValue([baseConversation]);

      const result = await controller.findBySession('session-1');

      expect(service.findBySession).toHaveBeenCalledWith('session-1');
      expect(result).toEqual([baseConversation]);
    });
  });

  describe('findOne', () => {
    it('service.findOne을 id로 호출한다', async () => {
      service.findOne.mockResolvedValue(baseConversation);

      const result = await controller.findOne('conv-uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('conv-uuid-1');
      expect(result).toBe(baseConversation);
    });
  });

  describe('remove', () => {
    it('service.remove를 id로 호출한다', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('conv-uuid-1');

      expect(service.remove).toHaveBeenCalledWith('conv-uuid-1');
    });
  });

  describe('removeBySession', () => {
    it('service.removeBySession을 sessionId로 호출한다', async () => {
      service.removeBySession.mockResolvedValue(undefined);

      await controller.removeBySession('session-1');

      expect(service.removeBySession).toHaveBeenCalledWith('session-1');
    });
  });
});
