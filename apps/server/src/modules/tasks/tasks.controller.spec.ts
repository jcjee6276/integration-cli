import { Test, TestingModule } from '@nestjs/testing';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import type { TaskEntity } from '../../database/entities/task.entity';
import type { TaskRunEntity } from '../../database/entities/task-run.entity';

const mockTask: TaskEntity = {
  id: 'task-1',
  title: 'Test Task',
  status: 'pending',
  workingDir: '/tmp/project',
  claudeSessionId: null,
  archived: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  requirements: [],
  agents: [],
};

describe('TasksController', () => {
  let controller: TasksController;
  let service: jest.Mocked<TasksService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            execute: jest.fn(),
            stop: jest.fn(),
            rerun: jest.fn(),
            rerunAgent: jest.fn(),
            getRuns: jest.fn(),
            archive: jest.fn(),
            mergeAgentAll: jest.fn(),
            mergeAgentFile: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TasksController);
    service = module.get(TasksService) as jest.Mocked<TasksService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('service.create를 호출하고 결과를 반환한다', async () => {
      service.create.mockResolvedValue(mockTask);

      const result = await controller.create({ title: 'Test Task' });

      expect(service.create).toHaveBeenCalledWith({ title: 'Test Task' });
      expect(result).toBe(mockTask);
    });
  });

  describe('findAll', () => {
    it('service.findAll를 호출하고 task 목록을 반환한다', async () => {
      service.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockTask]);
    });
  });

  describe('findOne', () => {
    it('service.findOne를 id와 함께 호출한다', async () => {
      service.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne('task-1');

      expect(service.findOne).toHaveBeenCalledWith('task-1');
      expect(result).toBe(mockTask);
    });
  });

  describe('update', () => {
    it('service.update를 id와 dto와 함께 호출한다', async () => {
      const updated = { ...mockTask, title: 'Updated' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update('task-1', { title: 'Updated' });

      expect(service.update).toHaveBeenCalledWith('task-1', { title: 'Updated' });
      expect(result).toBe(updated);
    });
  });

  describe('execute', () => {
    it('service.execute를 호출한다', async () => {
      const running = { ...mockTask, status: 'running' };
      service.execute.mockResolvedValue(running);

      const result = await controller.execute('task-1');

      expect(service.execute).toHaveBeenCalledWith('task-1');
      expect(result).toBe(running);
    });
  });

  describe('stop', () => {
    it('service.stop를 호출한다', async () => {
      const stopped = { ...mockTask, status: 'stopped' };
      service.stop.mockResolvedValue(stopped);

      const result = await controller.stop('task-1');

      expect(service.stop).toHaveBeenCalledWith('task-1');
      expect(result).toBe(stopped);
    });
  });

  describe('rerun', () => {
    it('service.rerun을 supplementNote와 함께 호출한다', async () => {
      service.rerun.mockResolvedValue(mockTask);

      const result = await controller.rerun('task-1', { supplementNote: '보완 작업' });

      expect(service.rerun).toHaveBeenCalledWith('task-1', '보완 작업');
      expect(result).toBe(mockTask);
    });

    it('supplementNote 없이 호출할 수 있다', async () => {
      service.rerun.mockResolvedValue(mockTask);

      await controller.rerun('task-1', {});

      expect(service.rerun).toHaveBeenCalledWith('task-1', undefined);
    });
  });

  describe('rerunAgent', () => {
    it('service.rerunAgent를 agentId와 supplementNote로 호출한다', async () => {
      service.rerunAgent.mockResolvedValue(mockTask);

      const result = await controller.rerunAgent('task-1', '2', { supplementNote: 'agent only' });

      expect(service.rerunAgent).toHaveBeenCalledWith('task-1', 2, 'agent only');
      expect(result).toBe(mockTask);
    });
  });

  describe('getRuns', () => {
    it('service.getRuns를 호출하고 실행 이력을 반환한다', async () => {
      const runs: TaskRunEntity[] = [
        { id: 1, taskId: 'task-1', version: 1, supplementNote: null, status: 'completed', startedAt: new Date(), completedAt: null, task: mockTask, agentRuns: [] },
      ];
      service.getRuns.mockResolvedValue(runs);

      const result = await controller.getRuns('task-1');

      expect(service.getRuns).toHaveBeenCalledWith('task-1');
      expect(result).toBe(runs);
    });
  });

  describe('archive', () => {
    it('service.archive를 호출한다', async () => {
      service.archive.mockResolvedValue(undefined);

      await controller.archive('task-1');

      expect(service.archive).toHaveBeenCalledWith('task-1');
    });
  });

  describe('mergeAgentAll', () => {
    it('service.mergeAgentAll을 id와 agentId로 호출한다', async () => {
      service.mergeAgentAll.mockResolvedValue({ success: true, message: '완료' });

      const result = await controller.mergeAgentAll('task-1', '2');

      expect(service.mergeAgentAll).toHaveBeenCalledWith('task-1', 2);
      expect(result).toEqual({ success: true, message: '완료' });
    });
  });

  describe('mergeAgentFile', () => {
    it('service.mergeAgentFile을 filePath와 함께 호출한다', async () => {
      service.mergeAgentFile.mockResolvedValue({ success: true, message: '완료' });

      const result = await controller.mergeAgentFile('task-1', '2', { filePath: 'src/app.ts' });

      expect(service.mergeAgentFile).toHaveBeenCalledWith('task-1', 2, 'src/app.ts');
      expect(result).toEqual({ success: true, message: '완료' });
    });
  });

  describe('remove', () => {
    it('service.remove를 호출한다', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('task-1');

      expect(service.remove).toHaveBeenCalledWith('task-1');
    });
  });
});
