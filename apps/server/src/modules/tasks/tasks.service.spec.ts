import * as fs from 'fs';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TaskAgentRunEntity } from '../../database/entities/task-agent-run.entity';
import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskRequirementEntity } from '../../database/entities/task-requirement.entity';
import { TaskRunEntity } from '../../database/entities/task-run.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { GitChangelogService } from '../changelog/changelog.service';
import { TasksService } from './tasks.service';

// task-execution.service는 node-pty / spawn 등 외부 프로세스에 의존하므로 전체 모킹
jest.mock('./task-execution.service', () => ({
  TaskExecutionService: class MockTaskExecutionService {
    spawnTask = jest.fn().mockResolvedValue(undefined);
    stopTask = jest.fn().mockResolvedValue(undefined);
  },
}));

// changelog.service는 git CLI에 의존하므로 전체 모킹
  jest.mock('../changelog/changelog.service', () => ({
    GitChangelogService: class MockGitChangelogService {
      mergeAll = jest.fn().mockReturnValue({ success: true, message: '전체 병합이 완료되었습니다.' });
      mergeFile = jest.fn().mockReturnValue({ success: true, message: 'file.ts 병합이 완료되었습니다.' });
      getByTask = jest.fn().mockResolvedValue([
        { agentId: 1, files: [{ id: 1, filePath: 'src/app.ts', changeType: 'modified', additions: 1, deletions: 0, patch: null }] },
      ]);
    },
  }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TaskExecutionService } = require('./task-execution.service');

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
}));

const mockRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })),
  save: jest.fn((e: any) => Promise.resolve(e)),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
});

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: ReturnType<typeof mockRepo>;
  let requirementRepo: ReturnType<typeof mockRepo>;
  let agentRepo: ReturnType<typeof mockRepo>;
  let runRepo: ReturnType<typeof mockRepo>;
  let executionService: { spawnTask: jest.Mock; stopTask: jest.Mock };
  let gitChangelogService: { mergeAll: jest.Mock; mergeFile: jest.Mock; getByTask: jest.Mock };

  const baseTask: TaskEntity = {
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

  const baseAgent: TaskAgentEntity = {
    id: 1,
    taskId: 'task-1',
    task: baseTask,
    agentType: 'claude',
    role: 'backend',
    customRole: null,
    claudeSessionId: null,
    worktreePath: '/tmp/worktrees/agent-1',
    startCommitHash: 'abc123',
    status: 'pending',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(TaskEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(TaskRequirementEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(TaskAgentEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(TaskRunEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(TaskAgentRunEntity), useFactory: mockRepo },
        { provide: TaskExecutionService, useClass: TaskExecutionService },
        { provide: GitChangelogService, useClass: GitChangelogService },
      ],
    }).compile();

    service = module.get(TasksService);
    taskRepo = module.get(getRepositoryToken(TaskEntity));
    requirementRepo = module.get(getRepositoryToken(TaskRequirementEntity));
    agentRepo = module.get(getRepositoryToken(TaskAgentEntity));
    runRepo = module.get(getRepositoryToken(TaskRunEntity));
    executionService = module.get(TaskExecutionService) as any;
    gitChangelogService = module.get(GitChangelogService) as any;
  });

  afterEach(() => jest.clearAllMocks());

  const mockDirectory = () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
  };

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('task를 반환한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      const result = await service.findOne('task-1');
      expect(result).toBe(baseTask);
      expect(taskRepo.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' }, relations: ['requirements', 'agents'] });
    });

    it('task가 없으면 NotFoundException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('아카이브되지 않은 task 목록을 반환한다', async () => {
      taskRepo.find.mockResolvedValue([baseTask]);
      const result = await service.findAll();
      expect(result).toEqual([baseTask]);
      expect(taskRepo.find).toHaveBeenCalledWith({
        where: { archived: false },
        relations: ['requirements', 'agents'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('요구사항과 에이전트 없이 task를 생성한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);

      const result = await service.create({ title: 'Test Task' });

      expect(taskRepo.create).toHaveBeenCalled();
      expect(taskRepo.save).toHaveBeenCalled();
      expect(requirementRepo.save).not.toHaveBeenCalled();
      expect(agentRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(baseTask);
    });

    it('요구사항 목록과 함께 task를 생성한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);

      await service.create({
        title: 'Task with requirements',
        requirements: [{ content: 'req-1' }, { content: 'req-2', orderIndex: 1 }],
      });

      expect(requirementRepo.save).toHaveBeenCalledTimes(1);
      const savedReqs = (requirementRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedReqs).toHaveLength(2);
      expect(savedReqs[0].content).toBe('req-1');
      expect(savedReqs[0].orderIndex).toBe(0);
      expect(savedReqs[1].content).toBe('req-2');
      expect(savedReqs[1].orderIndex).toBe(1);
    });

    it('에이전트 목록과 함께 task를 생성한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);

      await service.create({
        title: 'Task with agents',
        agents: [{ role: 'backend', agentType: 'claude' }, { role: 'frontend' }],
      });

      expect(agentRepo.save).toHaveBeenCalledTimes(1);
      const savedAgents = (agentRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedAgents).toHaveLength(2);
      expect(savedAgents[0].agentType).toBe('claude');
      expect(savedAgents[1].agentType).toBe('claude'); // default
    });

    it('workingDir을 null로 설정할 수 있다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, workingDir: null });

      await service.create({ title: 'No Dir Task' });

      const created = (taskRepo.create as jest.Mock).mock.calls[0][0];
      expect(created.workingDir).toBeNull();
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('title을 업데이트한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask });

      await service.update('task-1', { title: 'New Title' });

      expect(taskRepo.save).toHaveBeenCalled();
    });

    it('요구사항을 교체한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask });

      await service.update('task-1', {
        requirements: [{ content: 'new-req' }],
      });

      expect(requirementRepo.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(requirementRepo.save).toHaveBeenCalled();
    });

    it('빈 요구사항 배열로 모두 삭제한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask });

      await service.update('task-1', { requirements: [] });

      expect(requirementRepo.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(requirementRepo.save).not.toHaveBeenCalled();
    });

    it('에이전트를 교체한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask });

      await service.update('task-1', {
        agents: [{ role: 'frontend', agentType: 'gemini' }],
      });

      expect(agentRepo.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(agentRepo.save).toHaveBeenCalled();
    });

    it('task가 없으면 NotFoundException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.update('not-exist', { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── execute ─────────────────────────────────────────────────────────────

  describe('execute', () => {
    it('task를 실행하고 spawnTask를 호출한다', async () => {
      const pendingTask = { ...baseTask, status: 'pending' };
      taskRepo.findOne.mockResolvedValue(pendingTask);
      runRepo.findOne.mockResolvedValue(null);
      const mockRun = { id: 1, taskId: 'task-1', version: 1, status: 'running' };
      runRepo.save.mockResolvedValue(mockRun);

      await service.execute('task-1');

      expect(executionService.spawnTask).toHaveBeenCalledWith(pendingTask, undefined, mockRun.id);
    });

    it('이전 실행 기록이 있으면 다음 버전으로 실행한다', async () => {
      const stoppedTask = { ...baseTask, status: 'stopped', agents: [baseAgent] };
      taskRepo.findOne
        .mockResolvedValueOnce(stoppedTask)
        .mockResolvedValueOnce({ ...stoppedTask, status: 'pending' })
        .mockResolvedValueOnce({ ...stoppedTask, status: 'running' });
      runRepo.findOne.mockResolvedValue({ version: 2 });
      runRepo.save.mockResolvedValue({ id: 3, taskId: 'task-1', version: 3, status: 'running' });

      await service.execute('task-1');

      expect(agentRepo.update).toHaveBeenCalledWith(baseAgent.id, { status: 'pending', claudeSessionId: null });
      expect(runRepo.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        version: 3,
        supplementNote: null,
        status: 'running',
      });
    });

    it('이미 running 상태이면 spawnTask를 호출하지 않는다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, status: 'running' });

      await service.execute('task-1');

      expect(executionService.spawnTask).not.toHaveBeenCalled();
    });
  });

  // ─── rerun ────────────────────────────────────────────────────────────────

  describe('rerun', () => {
    it('에이전트 상태를 초기화하고 다음 버전으로 재실행한다', async () => {
      const taskWithAgents = { ...baseTask, agents: [baseAgent] };
      taskRepo.findOne.mockResolvedValue(taskWithAgents);
      runRepo.findOne.mockResolvedValue({ version: 2 });
      const mockRun = { id: 2, taskId: 'task-1', version: 3, status: 'running' };
      runRepo.save.mockResolvedValue(mockRun);

      await service.rerun('task-1', '보완 메모');

      expect(agentRepo.update).toHaveBeenCalledWith(baseAgent.id, { status: 'pending', claudeSessionId: null });
      expect(taskRepo.update).toHaveBeenCalledWith('task-1', { status: 'pending' });
      expect(executionService.spawnTask).toHaveBeenCalledWith(taskWithAgents, '보완 메모', mockRun.id);
    });

    it('실행 기록이 없으면 버전 1로 시작한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, agents: [] });
      runRepo.findOne.mockResolvedValue(null);
      const mockRun = { id: 1, taskId: 'task-1', version: 1, status: 'running' };
      runRepo.save.mockResolvedValue(mockRun);

      await service.rerun('task-1');

      const savedRun = (runRepo.create as jest.Mock).mock.calls[0][0];
      expect(savedRun.version).toBe(1);
    });

    it('이미 running 상태이면 재실행하지 않는다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, status: 'running' });

      await service.rerun('task-1');

      expect(executionService.spawnTask).not.toHaveBeenCalled();
    });
  });

  // ─── stop ─────────────────────────────────────────────────────────────────

  describe('rerunAgent', () => {
    it('선택한 에이전트만 다음 버전으로 재실행한다', async () => {
      const otherAgent = { ...baseAgent, id: 2, role: 'frontend' as const };
      const taskWithAgents = { ...baseTask, agents: [baseAgent, otherAgent] };
      taskRepo.findOne.mockResolvedValue(taskWithAgents);
      runRepo.findOne.mockResolvedValue({ version: 2 });
      const mockRun = { id: 3, taskId: 'task-1', version: 3, status: 'running' };
      runRepo.save.mockResolvedValue(mockRun);

      await service.rerunAgent('task-1', 1, 'agent note');

      expect(agentRepo.update).toHaveBeenCalledWith(baseAgent.id, { status: 'pending', claudeSessionId: null });
      expect(agentRepo.update).not.toHaveBeenCalledWith(otherAgent.id, expect.anything());
      expect(taskRepo.update).toHaveBeenCalledWith('task-1', { status: 'pending' });
      expect(runRepo.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        version: 3,
        supplementNote: 'agent note',
        status: 'running',
      });
      expect(executionService.spawnTask).toHaveBeenCalledWith(
        expect.objectContaining({ agents: [expect.objectContaining({ id: baseAgent.id })] }),
        'agent note',
        mockRun.id,
      );
    });

    it('대상 에이전트가 없으면 NotFoundException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, agents: [baseAgent] });

      await expect(service.rerunAgent('task-1', 999)).rejects.toThrow(NotFoundException);

      expect(executionService.spawnTask).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('실행 중인 task를 중지한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, status: 'running' });

      await service.stop('task-1');

      expect(executionService.stopTask).toHaveBeenCalled();
      expect(runRepo.update).toHaveBeenCalledWith(
        { taskId: 'task-1', status: 'running' },
        { status: 'stopped', completedAt: expect.any(Date) },
      );
    });
  });

  // ─── getRuns ─────────────────────────────────────────────────────────────

  describe('getRuns', () => {
    it('task의 실행 이력을 버전 내림차순으로 반환한다', async () => {
      const runs = [
        { id: 2, taskId: 'task-1', version: 2 },
        { id: 1, taskId: 'task-1', version: 1 },
      ];
      runRepo.find.mockResolvedValue(runs);

      const result = await service.getRuns('task-1');

      expect(result).toBe(runs);
      expect(runRepo.find).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        relations: ['agentRuns'],
        order: { version: 'DESC' },
      });
    });
  });

  // ─── archive ─────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('task를 아카이브한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);

      await service.archive('task-1');

      expect(taskRepo.update).toHaveBeenCalledWith('task-1', { archived: true });
    });

    it('존재하지 않는 task는 NotFoundException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.archive('not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('task를 삭제한다', async () => {
      await service.remove('task-1');
      expect(taskRepo.delete).toHaveBeenCalledWith('task-1');
    });
  });

  // ─── mergeAgentAll ───────────────────────────────────────────────────────

  describe('mergeAgentAll', () => {
    it('에이전트의 전체 변경사항을 병합한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(baseAgent);
      mockDirectory();

      const result = await service.mergeAgentAll('task-1', 1);

      expect(result).toEqual({ success: true, message: '전체 병합이 완료되었습니다.' });
      expect(gitChangelogService.mergeAll).toHaveBeenCalledWith(baseAgent.worktreePath, '/tmp/project');
    });

    it('에이전트가 없으면 NotFoundException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(null);

      await expect(service.mergeAgentAll('task-1', 999)).rejects.toThrow(NotFoundException);
    });

    it('worktreePath가 없으면 실패 메시지를 반환한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue({ ...baseAgent, worktreePath: null });

      const result = await service.mergeAgentAll('task-1', 1);

      expect(result).toEqual({ success: false, message: 'worktree가 존재하지 않습니다.' });
    });

    it('workingDir이 없으면 process.cwd()를 사용한다', async () => {
      taskRepo.findOne.mockResolvedValue({ ...baseTask, workingDir: null });
      agentRepo.findOne.mockResolvedValue(baseAgent);

      const result = await service.mergeAgentAll('task-1', 1);

      expect(result).toEqual({ success: true, message: '전체 병합이 완료되었습니다.' });
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(gitChangelogService.mergeAll).toHaveBeenCalledWith(baseAgent.worktreePath, process.cwd());
    });

    it('workingDir이 존재하지 않으면 BadRequestException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(baseAgent);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.mergeAgentAll('task-1', 1)).rejects.toThrow(BadRequestException);

      expect(gitChangelogService.mergeAll).not.toHaveBeenCalled();
    });
  });

  // ─── mergeAgentFile ──────────────────────────────────────────────────────

  describe('mergeAgentFile', () => {
    it('에이전트의 단일 파일을 병합한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(baseAgent);
      mockDirectory();

      const result = await service.mergeAgentFile('task-1', 1, 'src/app.ts');

      expect(result).toEqual({ success: true, message: 'file.ts 병합이 완료되었습니다.' });
      expect(gitChangelogService.getByTask).toHaveBeenCalledWith('task-1');
      expect(gitChangelogService.mergeFile).toHaveBeenCalledWith(baseAgent.worktreePath, '/tmp/project', 'src/app.ts');
    });

    it('에이전트가 없으면 NotFoundException을 던진다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(null);

      await expect(service.mergeAgentFile('task-1', 999, 'file.ts')).rejects.toThrow(NotFoundException);
    });

    it('worktreePath가 없으면 실패 메시지를 반환한다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue({ ...baseAgent, worktreePath: null });

      const result = await service.mergeAgentFile('task-1', 1, 'file.ts');

      expect(result).toEqual({ success: false, message: 'worktree가 존재하지 않습니다.' });
    });

    it('changelog에 없는 파일이면 BadRequestException을 던지고 병합하지 않는다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(baseAgent);
      gitChangelogService.getByTask.mockResolvedValueOnce([
        { agentId: 1, files: [{ id: 1, filePath: 'src/allowed.ts', changeType: 'modified', additions: 1, deletions: 0, patch: null }] },
      ]);
      mockDirectory();

      await expect(service.mergeAgentFile('task-1', 1, 'src/app.ts')).rejects.toThrow(BadRequestException);

      expect(gitChangelogService.mergeFile).not.toHaveBeenCalled();
    });

    it('다른 agent의 changelog 파일이면 병합하지 않는다', async () => {
      taskRepo.findOne.mockResolvedValue(baseTask);
      agentRepo.findOne.mockResolvedValue(baseAgent);
      gitChangelogService.getByTask.mockResolvedValueOnce([
        { agentId: 2, files: [{ id: 1, filePath: 'src/app.ts', changeType: 'modified', additions: 1, deletions: 0, patch: null }] },
      ]);
      mockDirectory();

      await expect(service.mergeAgentFile('task-1', 1, 'src/app.ts')).rejects.toThrow(BadRequestException);

      expect(gitChangelogService.mergeFile).not.toHaveBeenCalled();
    });
  });
});
