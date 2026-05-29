import { EventEmitter } from 'events';
import { spawn } from 'child_process';

import { ClaudePtyManager } from './claude/claude-pty.manager';
import { CodexSessionManager } from './codex/codex-session.manager';
import { GeminiSessionManager } from './gemini/gemini-session.manager';

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
  proc.kill = jest.fn(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('agent session termination', () => {
  afterEach(() => jest.clearAllMocks());

  it('kills a running Claude process and does not reset DB status to idle after close', async () => {
    const proc = mockProcess();
    spawnMock.mockReturnValueOnce(proc);
    const agentRepo = mockRepo();
    const sessionRepo = mockRepo();
    const manager = new ClaudePtyManager(agentRepo as never, sessionRepo as never);
    const session = manager.createSession('/tmp/project');

    manager.sendMessage(session.id, 'hello');
    await flushPromises();
    manager.terminateSession(session.id);
    proc.emit('close', 0);

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(agentRepo.update).toHaveBeenCalledWith(session.id, { status: 'terminated' });
    expect(agentRepo.update).not.toHaveBeenCalledWith(session.id, { status: 'idle' });
  });

  it('kills a running Gemini process and does not reset DB status to idle after close', async () => {
    const proc = mockProcess();
    spawnMock.mockReturnValueOnce(proc);
    const agentRepo = mockRepo();
    const sessionRepo = mockRepo();
    const authManager = { getEnvForGemini: jest.fn(() => ({})) };
    const manager = new GeminiSessionManager(agentRepo as never, sessionRepo as never, authManager as never);
    const session = manager.createSession('/tmp/project');

    manager.sendMessage(session.id, 'hello');
    await flushPromises();
    manager.terminateSession(session.id);
    proc.emit('close', 0);

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(agentRepo.update).toHaveBeenCalledWith(session.id, { status: 'terminated' });
    expect(agentRepo.update).not.toHaveBeenCalledWith(session.id, { status: 'idle' });
  });

  it('kills a running Codex process and persists terminated status', async () => {
    const proc = mockProcess();
    spawnMock.mockReturnValueOnce(proc);
    const agentRepo = mockRepo();
    const sessionRepo = mockRepo();
    const authManager = { getEnvForCodex: jest.fn(() => ({})) };
    const manager = new CodexSessionManager(agentRepo as never, sessionRepo as never, authManager as never);
    const session = manager.createSession('/tmp/project');

    manager.sendMessage(session.id, 'hello');
    await flushPromises();
    manager.terminateSession(session.id);
    proc.emit('close', 0);

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(agentRepo.update).toHaveBeenCalledWith(session.id, { status: 'terminated' });
    expect(agentRepo.update).not.toHaveBeenCalledWith(session.id, { status: 'idle' });
  });
});
