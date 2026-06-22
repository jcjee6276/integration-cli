import { EventEmitter } from 'events';

import type { ClaudePtyManager } from '../agents/claude/claude-pty.manager';
import type { CodexSessionManager } from '../agents/codex/codex-session.manager';
import type { GeminiSessionManager } from '../agents/gemini/gemini-session.manager';
import type { ConversationService } from '../conversations/conversation.service';
import { HandoffService } from './handoff.service';

function makeManager() {
  return Object.assign(new EventEmitter(), {
    createSession: jest.fn(() => ({ id: 'sess-1' })),
    sendMessage: jest.fn(),
  });
}

describe('HandoffService.createBatch', () => {
  let service: HandoffService;
  let codex: ReturnType<typeof makeManager>;
  let conversation: { create: jest.Mock };

  beforeEach(() => {
    codex = makeManager();
    conversation = { create: jest.fn().mockResolvedValue({}) };
    service = new HandoffService(
      makeManager() as unknown as ClaudePtyManager,
      makeManager() as unknown as GeminiSessionManager,
      codex as unknown as CodexSessionManager,
      conversation as unknown as ConversationService,
    );
  });

  it('여러 이슈를 세션 1개·메시지 1개로 위임한다', async () => {
    const result = await service.createBatch({
      agentId: 'codex',
      projectPath: '/proj',
      items: [
        { title: 'TypeError x', route: '/a', filePath: '/proj/a.tsx', line: 3, endLine: 5 },
        { title: 'GET 500 /api', route: '/b' },
        { title: '과다 리렌더: Foo', route: '/a', filePath: '/proj/foo.tsx', line: 10 },
      ],
    });

    // 세션 1개, 메시지 1회
    expect(codex.createSession).toHaveBeenCalledTimes(1);
    expect(codex.sendMessage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ agentId: 'codex', sessionId: 'sess-1', count: 3 });

    // 단일 프롬프트에 모든 이슈가 포함
    const prompt = codex.sendMessage.mock.calls[0][1] as string;
    expect(prompt).toContain('이슈 3건');
    expect(prompt).toContain('TypeError x');
    expect(prompt).toContain('GET 500 /api');
    expect(prompt).toContain('과다 리렌더: Foo');
    expect(prompt).toContain('/proj/a.tsx:3-5');
  });

  it('대화 기록도 세션당 1회만 저장한다', async () => {
    await service.createBatch({
      agentId: 'codex',
      items: [{ title: 'A' }, { title: 'B' }],
    });
    // 사용자 메시지 저장 1회 (에이전트 응답 저장은 이벤트 기반이라 별개)
    expect(conversation.create).toHaveBeenCalledTimes(1);
  });
});
