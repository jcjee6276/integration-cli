import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AgentChangelogEntity } from '../../database/entities/agent-changelog.entity';
import { GitChangelogService } from './changelog.service';

jest.mock('fs');
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  execFileSync: jest.fn(),
}));

const mockRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })),
  save: jest.fn((e: any) => Promise.resolve(Array.isArray(e) ? e : [e])),
  findOne: jest.fn(),
  find: jest.fn(),
});

describe('GitChangelogService', () => {
  let service: GitChangelogService;
  let repo: ReturnType<typeof mockRepo>;

  const execSync = childProcess.execSync as jest.Mock;
  const execFileSync = childProcess.execFileSync as jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitChangelogService,
        { provide: getRepositoryToken(AgentChangelogEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(GitChangelogService);
    repo = module.get(getRepositoryToken(AgentChangelogEntity));
    jest.clearAllMocks();
  });

  // ─── isGitRepo ───────────────────────────────────────────────────────────

  describe('isGitRepo', () => {
    it('git repo이면 true를 반환한다', () => {
      execSync.mockReturnValue('');

      expect(service.isGitRepo('/some/dir')).toBe(true);
      expect(execSync).toHaveBeenCalledWith('git rev-parse --git-dir', expect.objectContaining({ cwd: '/some/dir' }));
    });

    it('git repo가 아니면 false를 반환한다', () => {
      execSync.mockImplementation(() => { throw new Error('not a git repo'); });

      expect(service.isGitRepo('/not/a/repo')).toBe(false);
    });
  });

  // ─── getCurrentHead ──────────────────────────────────────────────────────

  describe('getCurrentHead', () => {
    it('현재 HEAD 커밋 SHA를 반환한다', () => {
      execSync.mockReturnValue('abc123def456\n');

      const result = service.getCurrentHead('/repo');

      expect(result).toBe('abc123def456');
    });
  });

  // ─── getCurrentBranch ────────────────────────────────────────────────────

  describe('getCurrentBranch', () => {
    it('현재 브랜치명을 반환한다', () => {
      execSync.mockReturnValue('main\n');

      const result = service.getCurrentBranch('/repo');

      expect(result).toBe('main');
    });

    it('특수문자를 대시로 치환하고 40자로 자른다', () => {
      const longBranch = 'feature/some-branch-name-that-is-very-very-long-and-has/slashes';
      execSync.mockReturnValue(longBranch + '\n');

      const result = service.getCurrentBranch('/repo');

      expect(result).not.toContain('/');
      expect(result.length).toBeLessThanOrEqual(40);
    });

    it('에러 발생 시 "unknown"을 반환한다', () => {
      execSync.mockImplementation(() => { throw new Error('git error'); });

      const result = service.getCurrentBranch('/repo');

      expect(result).toBe('unknown');
    });
  });

  // ─── getRepoRoot ─────────────────────────────────────────────────────────

  describe('getRepoRoot', () => {
    it('git repo의 루트 디렉토리를 반환한다', () => {
      execSync.mockReturnValue('/path/to/repo\n');

      const result = service.getRepoRoot('/path/to/repo/subdir');

      expect(result).toBe('/path/to/repo');
    });
  });

  // ─── mergeAll ────────────────────────────────────────────────────────────

  describe('mergeAll', () => {
    it('전체 변경사항을 병합하고 성공 결과를 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      execSync.mockReturnValue('/repo\n'); // getRepoRoot uses execSync
      execFileSync
        .mockReturnValueOnce('agent-branch\n') // getCurrentBranch in worktree
        .mockReturnValueOnce(''); // merge

      const result = service.mergeAll('/tmp/worktrees/agent-1', '/repo');

      expect(result.success).toBe(true);
      expect(result.message).toBe('전체 병합이 완료되었습니다.');
    });

    it('worktree 경로가 없으면 실패 메시지를 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.mergeAll('/not/exist', '/repo');

      expect(result.success).toBe(false);
      expect(result.message).toContain('worktree 경로가 존재하지 않습니다');
    });

    it('merge 실패 시 false를 반환하고 abort를 시도한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      execSync.mockReturnValue('/repo\n'); // getRepoRoot (main flow + catch block)
      execFileSync
        .mockReturnValueOnce('agent-branch\n') // getCurrentBranch in worktree
        .mockImplementationOnce(() => { throw new Error('merge conflict'); }) // merge fails
        .mockReturnValueOnce(''); // abort in catch

      const result = service.mergeAll('/tmp/worktrees/agent-1', '/repo');

      expect(result.success).toBe(false);
    });
  });

  // ─── mergeFile ───────────────────────────────────────────────────────────

  describe('mergeFile', () => {
    it('단일 파일을 병합하고 성공 결과를 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      execSync.mockReturnValue('/repo\n'); // getRepoRoot
      execFileSync
        .mockReturnValueOnce('agent-branch\n') // getCurrentBranch in worktree
        .mockReturnValueOnce(''); // checkout

      const result = service.mergeFile('/tmp/worktrees/agent-1', '/repo', 'src/app.ts');

      expect(result.success).toBe(true);
      expect(result.message).toContain('src/app.ts');
    });

    it('worktree 경로가 없으면 실패 메시지를 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.mergeFile('/not/exist', '/repo', 'file.ts');

      expect(result.success).toBe(false);
      expect(result.message).toContain('worktree 경로가 존재하지 않습니다');
    });

    it('checkout 실패 시 에러 메시지를 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      execSync.mockReturnValue('/repo\n'); // getRepoRoot
      execFileSync
        .mockReturnValueOnce('agent-branch\n') // getCurrentBranch
        .mockImplementationOnce(() => { throw new Error('file not found'); }); // checkout fails

      const result = service.mergeFile('/tmp/worktrees/agent-1', '/repo', 'missing.ts');

      expect(result.success).toBe(false);
      expect(result.message).toContain('file not found');
    });

    it('상위 디렉토리 pathspec은 거부한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = service.mergeFile('/tmp/worktrees/agent-1', '/repo', '../secret.ts');

      expect(result.success).toBe(false);
      expect(result.message).toContain('유효하지 않은 파일 경로입니다');
      expect(execSync).not.toHaveBeenCalled();
      expect(execFileSync).not.toHaveBeenCalled();
    });
  });

  // ─── getLatestRunId ──────────────────────────────────────────────────────

  describe('getLatestRunId', () => {
    it('가장 최근 runId를 반환한다', async () => {
      repo.findOne.mockResolvedValue({ runId: 5 });

      const result = await service.getLatestRunId('task-1');

      expect(result).toBe(5);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        order: { runId: 'DESC' },
        select: ['runId'],
      });
    });

    it('기록이 없으면 null을 반환한다', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.getLatestRunId('empty-task');

      expect(result).toBeNull();
    });
  });

  // ─── getByTask ───────────────────────────────────────────────────────────

  describe('getByTask', () => {
    it('task의 changelog를 에이전트별로 그룹핑해서 반환한다', async () => {
      repo.findOne.mockResolvedValue({ runId: 3 });
      repo.find.mockResolvedValue([
        { id: 1, taskId: 'task-1', agentId: 1, runId: 3, filePath: 'src/a.ts', changeType: 'modified', additions: 5, deletions: 2, patch: 'diff...' },
        { id: 2, taskId: 'task-1', agentId: 1, runId: 3, filePath: 'src/b.ts', changeType: 'added', additions: 10, deletions: 0, patch: 'diff...' },
        { id: 3, taskId: 'task-1', agentId: 2, runId: 3, filePath: 'src/c.ts', changeType: 'deleted', additions: 0, deletions: 3, patch: 'diff...' },
      ]);

      const result = await service.getByTask('task-1');

      expect(result).toHaveLength(2);
      expect(result[0].agentId).toBe(1);
      expect(result[0].files).toHaveLength(2);
      expect(result[1].agentId).toBe(2);
      expect(result[1].files).toHaveLength(1);
    });

    it('runId를 직접 지정하면 해당 run의 결과만 반환한다', async () => {
      repo.find.mockResolvedValue([
        { id: 1, taskId: 'task-1', agentId: 1, runId: 2, filePath: 'src/x.ts', changeType: 'modified', additions: 1, deletions: 1, patch: null },
      ]);

      const result = await service.getByTask('task-1', 2);

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { taskId: 'task-1', runId: 2 },
      }));
      expect(result).toHaveLength(1);
    });

    it('changelog가 없으면 빈 배열을 반환한다', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.find.mockResolvedValue([]);

      const result = await service.getByTask('task-1');

      expect(result).toEqual([]);
    });
  });

  // ─── parseDiff (private, via any 접근) ──────────────────────────────────

  describe('parseDiff', () => {
    const parseDiff = (diffText: string) => (service as any).parseDiff(diffText);

    it('modified 파일을 파싱한다', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
index abc..def 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
`;
      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('src/app.ts');
      expect(result[0].changeType).toBe('modified');
      expect(result[0].additions).toBe(2);
      expect(result[0].deletions).toBe(1);
    });

    it('새로 추가된 파일을 파싱한다', () => {
      const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 000..abc
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const x = 1;
+export const y = 2;
`;
      const result = parseDiff(diff);

      expect(result[0].changeType).toBe('added');
      expect(result[0].additions).toBe(2);
      expect(result[0].deletions).toBe(0);
    });

    it('삭제된 파일을 파싱한다', () => {
      const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc..000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const x = 1;
-export const y = 2;
`;
      const result = parseDiff(diff);

      expect(result[0].changeType).toBe('deleted');
      expect(result[0].deletions).toBe(2);
    });

    it('rename된 파일을 파싱한다', () => {
      const diff = `diff --git a/src/old.ts b/src/renamed.ts
rename from src/old.ts
rename to src/renamed.ts
similarity index 100%
`;
      const result = parseDiff(diff);

      expect(result[0].changeType).toBe('renamed');
      expect(result[0].filePath).toBe('src/renamed.ts');
    });

    it('여러 파일을 포함한 diff를 파싱한다', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
index abc..def 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
 const a = 1;
+const b = 2;
diff --git a/src/b.ts b/src/b.ts
new file mode 100644
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1 @@
+export default {};
`;
      const result = parseDiff(diff);

      expect(result).toHaveLength(2);
      expect(result[0].filePath).toBe('src/a.ts');
      expect(result[1].filePath).toBe('src/b.ts');
    });

    it('빈 diff는 빈 배열을 반환한다', () => {
      expect(parseDiff('')).toEqual([]);
    });

    it('200KB 초과 patch는 truncated 처리한다', () => {
      const longContent = '+' + 'x'.repeat(210_000);
      const diff = `diff --git a/big.ts b/big.ts
index abc..def 100644
--- a/big.ts
+++ b/big.ts
@@ -1 +1 @@
${longContent}
`;
      const result = parseDiff(diff);

      expect(result[0].patch).toContain('(truncated)');
    });

    it('+++ / --- 헤더 라인은 추가/삭제 카운트에 포함하지 않는다', () => {
      const diff = `diff --git a/src/x.ts b/src/x.ts
index abc..def 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,2 +1,2 @@
-old line
+new line
`;
      const result = parseDiff(diff);

      expect(result[0].additions).toBe(1);
      expect(result[0].deletions).toBe(1);
    });
  });

  // ─── captureAndSave ──────────────────────────────────────────────────────

  describe('captureAndSave', () => {
    it('변경사항을 커밋하고 DB에 저장한 뒤 snapshotSha를 반환한다', async () => {
      execSync
        .mockReturnValueOnce('') // git add -A
        .mockReturnValueOnce('') // git commit
        .mockReturnValueOnce('newsha123\n') // git rev-parse HEAD
        .mockReturnValueOnce(`diff --git a/src/x.ts b/src/x.ts
index abc..def 100644
--- a/src/x.ts
+++ b/src/x.ts
@@ -1 +1 @@
-old
+new
`); // git diff

      const result = await service.captureAndSave('task-1', 1, '/worktree', 'startsha', 'task commit', 2);

      expect(result).toBe('newsha123');
      expect(repo.save).toHaveBeenCalled();
    });

    it('변경사항이 없으면 DB 저장 없이 snapshotSha를 반환한다', async () => {
      execSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('newsha123\n')
        .mockReturnValueOnce('   '); // empty diff

      const result = await service.captureAndSave('task-1', 1, '/worktree', 'startsha', 'task commit');

      expect(result).toBe('newsha123');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('에러 발생 시 null을 반환한다', async () => {
      execSync.mockImplementation(() => { throw new Error('git error'); });

      const result = await service.captureAndSave('task-1', 1, '/worktree', 'startsha', 'task commit');

      expect(result).toBeNull();
    });
  });

  // ─── mergeToMain ─────────────────────────────────────────────────────────

  describe('mergeToMain', () => {
    it('스냅샷 커밋을 main repo에 merge한다', () => {
      execSync.mockReturnValue('');

      expect(() => service.mergeToMain('/repo', 'snapshotsha', 1)).not.toThrow();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('merge --no-ff'),
        expect.anything(),
      );
    });

    it('merge 충돌 시 abort를 시도하고 경고만 남긴다', () => {
      execSync
        .mockImplementationOnce(() => { throw new Error('conflict'); })
        .mockReturnValueOnce(''); // abort

      expect(() => service.mergeToMain('/repo', 'sha', 1)).not.toThrow();
    });
  });
});
