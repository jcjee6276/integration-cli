import { Test, TestingModule } from '@nestjs/testing';

import { SessionEntity } from '../../database/entities/session.entity';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

const baseSession: SessionEntity = {
  sessionId: 'sess-uuid-1',
  agentType: 'claude',
  title: 'Test Session',
  createdAt: new Date('2024-01-01'),
};

describe('SessionController', () => {
  let controller: SessionController;
  let service: jest.Mocked<SessionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SessionController);
    service = module.get(SessionService) as jest.Mocked<SessionService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('agentType 없이 전체 목록을 반환한다', async () => {
      service.findAll.mockResolvedValue([baseSession]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([baseSession]);
    });

    it('agentType 필터와 함께 목록을 반환한다', async () => {
      service.findAll.mockResolvedValue([baseSession]);

      const result = await controller.findAll('claude');

      expect(service.findAll).toHaveBeenCalledWith('claude');
      expect(result).toEqual([baseSession]);
    });
  });

  describe('findOne', () => {
    it('service.findOne을 sessionId로 호출한다', async () => {
      service.findOne.mockResolvedValue(baseSession);

      const result = await controller.findOne('sess-uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('sess-uuid-1');
      expect(result).toBe(baseSession);
    });
  });
});
