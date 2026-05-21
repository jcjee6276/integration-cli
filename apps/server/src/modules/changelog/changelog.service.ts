import { execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AgentChangelogEntity, ChangeType } from '../../database/entities/agent-changelog.entity';

interface ParsedFile {
  filePath: string;
  changeType: ChangeType;
  patch: string;
  additions: number;
  deletions: number;
}

export interface AgentChangelog {
  agentId: number;
  files: Array<{
    id: number;
    filePath: string;
    changeType: ChangeType;
    additions: number;
    deletions: number;
    patch: string | null;
  }>;
}

@Injectable()
export class GitChangelogService {
  private readonly logger = new Logger(GitChangelogService.name);

  constructor(
    @InjectRepository(AgentChangelogEntity)
    private readonly changelogRepo: Repository<AgentChangelogEntity>,
  ) {}

  // ─── Git 유틸 ─────────────────────────────────────────────────────────

  isGitRepo(dir: string): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  getCurrentHead(repoDir: string): string {
    return execSync('git rev-parse HEAD', { cwd: repoDir, encoding: 'utf8', timeout: 3000 }).trim();
  }

  getCurrentBranch(repoDir: string): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoDir, encoding: 'utf8', timeout: 3000 }).trim();
      // detached HEAD나 특수문자 제거하여 브랜치명을 파일시스템 안전하게 변환
      return branch.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 40);
    } catch {
      return 'unknown';
    }
  }

  // ─── Worktree 생성/제거 ───────────────────────────────────────────────

  createWorktree(repoDir: string, agentType: string): { worktreePath: string; branchName: string } {
    const ts = Date.now();
    const currentBranch = this.getCurrentBranch(repoDir);
    const branchName = `${agentType}-${currentBranch}-${ts}`;
    const worktreePath = path.join(os.tmpdir(), 'ji-worktrees', branchName);
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
    execSync(`git worktree add "${worktreePath}" -b "${branchName}" HEAD`, {
      cwd: repoDir,
      stdio: 'ignore',
      timeout: 10000,
    });
    this.logger.log(`Worktree 생성: ${worktreePath} (branch: ${branchName})`);
    return { worktreePath, branchName };
  }

  removeWorktree(repoDir: string, worktreePath: string, branchName: string): void {
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: repoDir,
        stdio: 'ignore',
        timeout: 10000,
      });
      // worktree 제거 후 브랜치도 삭제
      execSync(`git branch -D "${branchName}"`, {
        cwd: repoDir,
        stdio: 'ignore',
        timeout: 5000,
      });
      this.logger.log(`Worktree 제거: ${worktreePath} (branch: ${branchName})`);
    } catch (err) {
      this.logger.warn(`Worktree 제거 실패 (무시): ${err}`);
    }
  }

  // ─── Diff 캡처 + DB 저장 ──────────────────────────────────────────────

  /**
   * worktree의 변경사항을 diff로 캡처해 DB에 저장하고,
   * 스냅샷 커밋 SHA를 반환한다 (main repo merge에 사용).
   * 변경사항이 없으면 null 반환.
   */
  async captureAndSave(
    taskId: string,
    agentId: number,
    worktreePath: string,
    startCommitHash: string,
  ): Promise<string | null> {
    try {
      // 미커밋 변경사항 전부 스테이징
      execSync('git add -A', { cwd: worktreePath, stdio: 'ignore', timeout: 10000 });

      // 스냅샷 커밋
      execSync(
        'git -c core.hooksPath=/dev/null commit --allow-empty -m "_ji_snapshot"',
        { cwd: worktreePath, stdio: 'ignore', timeout: 10000 },
      );

      const snapshotSha = execSync('git rev-parse HEAD', {
        cwd: worktreePath,
        encoding: 'utf8',
        timeout: 5000,
      }).trim();

      // 시작 시점부터 현재까지 전체 diff
      const diffOutput = execSync(`git diff "${startCommitHash}"..HEAD`, {
        cwd: worktreePath,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30000,
      });

      if (!diffOutput.trim()) {
        this.logger.log(`Agent ${agentId}: 변경사항 없음`);
        return snapshotSha;
      }

      const files = this.parseDiff(diffOutput);
      if (files.length) {
        await this.changelogRepo.save(
          files.map((f) =>
            this.changelogRepo.create({
              taskId,
              agentId,
              filePath: f.filePath,
              changeType: f.changeType,
              patch: f.patch,
              additions: f.additions,
              deletions: f.deletions,
            }),
          ),
        );
        this.logger.log(`Agent ${agentId}: ${files.length}개 파일 변경사항 저장`);
      }

      return snapshotSha;
    } catch (err) {
      this.logger.warn(`Agent ${agentId} changelog 캡처 실패: ${err}`);
      return null;
    }
  }

  /**
   * worktree의 스냅샷 커밋을 main 레포에 merge한다.
   * 충돌 발생 시 merge를 abort하고 경고만 남긴다.
   */
  mergeToMain(mainRepoDir: string, snapshotSha: string, agentId: number): void {
    try {
      execSync(
        `git -c core.hooksPath=/dev/null merge --no-ff "${snapshotSha}" -m "chore: apply agent-${agentId} changes"`,
        { cwd: mainRepoDir, stdio: 'ignore', timeout: 30000 },
      );
      this.logger.log(`Agent ${agentId}: main repo merge 완료 (${snapshotSha.slice(0, 7)})`);
    } catch (err) {
      this.logger.warn(`Agent ${agentId}: merge 충돌 발생 — 중단하고 changelog만 유지합니다. ${err}`);
      try {
        execSync('git merge --abort', { cwd: mainRepoDir, stdio: 'ignore', timeout: 5000 });
      } catch {}
    }
  }

  // ─── 조회 ─────────────────────────────────────────────────────────────

  async getByTask(taskId: string): Promise<AgentChangelog[]> {
    const rows = await this.changelogRepo.find({
      where: { taskId },
      order: { agentId: 'ASC', id: 'ASC' },
    });

    const byAgent = new Map<number, AgentChangelog>();
    for (const row of rows) {
      if (!byAgent.has(row.agentId)) {
        byAgent.set(row.agentId, { agentId: row.agentId, files: [] });
      }
      byAgent.get(row.agentId)!.files.push({
        id: row.id,
        filePath: row.filePath,
        changeType: row.changeType,
        additions: row.additions,
        deletions: row.deletions,
        patch: row.patch,
      });
    }

    return Array.from(byAgent.values());
  }

  // ─── Unified diff 파싱 ────────────────────────────────────────────────

  private parseDiff(diff: string): ParsedFile[] {
    const files: ParsedFile[] = [];
    const sections = diff.split(/^diff --git /m).filter(Boolean);

    for (const section of sections) {
      const full = `diff --git ${section}`;
      const lines = section.split('\n');
      const header = lines[0] ?? '';

      // "a/src/foo.ts b/src/foo.ts" 형식 파싱
      const match = header.match(/^a\/(.+?) b\/(.+)$/);
      if (!match) continue;

      const filePath = match[2];

      let changeType: ChangeType = 'modified';
      if (full.includes('\nnew file mode')) changeType = 'added';
      else if (full.includes('\ndeleted file mode')) changeType = 'deleted';
      else if (full.includes('\nrename from ')) changeType = 'renamed';

      let additions = 0;
      let deletions = 0;
      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }

      files.push({
        filePath,
        changeType,
        // 파일당 최대 200KB 제한
        patch: full.length > 200_000 ? full.slice(0, 200_000) + '\n... (truncated)' : full,
        additions,
        deletions,
      });
    }

    return files;
  }
}
