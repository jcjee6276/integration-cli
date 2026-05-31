import { EventEmitter } from 'events';
import { spawn } from 'child_process';

import { ClaudePtyManager } from './claude/claude-pty.manager';
import { CodexSessionManager } from './codex/codex-session.manager';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

const spawnMock = spawn as jest.Mock;

function mockRepo() {
  return {
    save: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
  };
}

function mockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    killed: boolean;
    kill: jest.Mock;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killed = false;
  proc.kill = jest.fn();
  return proc;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('agent model settings', () => {
  afterEach(() => jest.clearAllMocks());

  it('passes Claude model and reasoning to the CLI', async () => {
    const proc = mockProcess();
    spawnMock.mockReturnValueOnce(proc);
    const agentRepo = mockRepo();
    const sessionRepo = mockRepo();
    const manager = new ClaudePtyManager(agentRepo as never, sessionRepo as never);
    const session = manager.createSession('/tmp/project', 'sonnet', 'high');

    manager.sendMessage(session.id, 'hello');
    await flushPromises();

    expect(spawnMock).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--model', 'sonnet', '--effort', 'high']),
      expect.objectContaining({ cwd: '/tmp/project' }),
    );
  });

  it('passes Codex model and reasoning to the CLI', async () => {
    const proc = mockProcess();
    spawnMock.mockReturnValueOnce(proc);
    const agentRepo = mockRepo();
    const sessionRepo = mockRepo();
    const authManager = { getEnvForCodex: jest.fn(() => ({})) };
    const manager = new CodexSessionManager(agentRepo as never, sessionRepo as never, authManager as never);
    const session = manager.createSession('/tmp/project', 'gpt-5.5', 'xhigh');

    manager.sendMessage(session.id, 'hello');
    await flushPromises();

    expect(spawnMock).toHaveBeenCalledWith(
      'codex',
      expect.arrayContaining(['exec', '-m', 'gpt-5.5', '-c', 'model_reasoning_effort="xhigh"']),
      expect.objectContaining({ cwd: '/tmp/project' }),
    );
  });
});
