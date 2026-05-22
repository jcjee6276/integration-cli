import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { JI_PATHS } from '../../common/ji-paths';

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
      return branch.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 40);
    } catch {
      return 'unknown';
    }
  }

  /** .git이 있는 실제 repo root 반환 */
  getRepoRoot(dir: string): string {
    return execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf8', timeout: 3000 }).trim();
  }

  // ─── Worktree 생성/제거 ───────────────────────────────────────────────

  /**
   * workingDir 기준으로 worktree를 생성한다.
   * .git이 상위에 있어도 repo root를 찾아 worktree를 만들고,
   * 에이전트가 실행될 실제 서브 경로(agentWorkDir)를 함께 반환한다.
   */
  createWorktree(workingDir: string, agentType: string): { worktreePath: string; branchName: string; agentWorkDir: string } {
    const repoRoot = this.getRepoRoot(workingDir);
    const ts = Date.now();
    const currentBranch = this.getCurrentBranch(workingDir);
    const branchName = `${agentType}-${currentBranch}-${ts}`;
    const worktreePath = path.join(JI_PATHS.worktrees, branchName);
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
    execFileSync('git', ['worktree', 'add', worktreePath, '-b', branchName, 'HEAD'], {
      cwd: repoRoot,
      stdio: 'ignore',
      timeout: 10000,
    });
    // workingDir이 repo root의 서브 디렉토리라면 worktree 안에서도 같은 서브 경로 사용
    const relativeSubDir = path.relative(repoRoot, workingDir);
    const agentWorkDir = relativeSubDir
      ? path.join(worktreePath, relativeSubDir)
      : worktreePath;

    this.logger.log(`Worktree 생성: ${worktreePath} (branch: ${branchName}, agentDir: ${agentWorkDir})`);
    return { worktreePath, branchName, agentWorkDir };
  }

  removeWorktree(repoDir: string, worktreePath: string, branchName: string): void {
    try {
      const repoRoot = this.getRepoRoot(repoDir);
      execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: repoRoot,
        stdio: 'ignore',
        timeout: 10000,
      });
      execFileSync('git', ['branch', '-D', branchName], {
        cwd: repoRoot,
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
    commitMessage: string,
    runId?: number,
  ): Promise<string | null> {
    try {
      // 미커밋 변경사항 전부 스테이징
      execSync('git add -A', { cwd: worktreePath, stdio: 'ignore', timeout: 10000 });

      // task 기반 커밋 메시지로 스냅샷 커밋
      const safeMsg = commitMessage.replace(/'/g, "'\\''");
      execSync(
        `git -c core.hooksPath=/dev/null commit --allow-empty -m '${safeMsg}'`,
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
              runId: runId ?? null,
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

  // ─── 병합 ─────────────────────────────────────────────────────────────

  /** worktree의 모든 변경사항을 main 레포에 병합 */
  mergeAll(worktreePath: string, workingDir: string): { success: boolean; message: string } {
    if (!fs.existsSync(worktreePath)) {
      return { success: false, message: `worktree 경로가 존재하지 않습니다: ${worktreePath}` };
    }

    try {
      const repoRoot = this.getRepoRoot(workingDir);
      const branchName = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: worktreePath,
        encoding: 'utf8',
        timeout: 3000,
      }).trim();

      execFileSync(
        'git',
        ['-c', 'core.hooksPath=/dev/null', 'merge', '--no-ff', branchName],
        { cwd: repoRoot, timeout: 30000 },
      );
      this.logger.log(`전체 병합 완료: ${branchName} → ${repoRoot}`);
      return { success: true, message: '전체 병합이 완료되었습니다.' };
    } catch (err) {
      try {
        const repoRoot = this.getRepoRoot(workingDir);
        execFileSync('git', ['merge', '--abort'], { cwd: repoRoot });
      } catch {}
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`전체 병합 실패: ${msg}`);
      return { success: false, message: msg };
    }
  }

  /** worktree에서 특정 파일만 main 레포에 병합 */
  mergeFile(worktreePath: string, workingDir: string, filePath: string): { success: boolean; message: string } {
    if (!fs.existsSync(worktreePath)) {
      return { success: false, message: `worktree 경로가 존재하지 않습니다: ${worktreePath}` };
    }

    try {
      const repoRoot = this.getRepoRoot(workingDir);
      const branchName = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: worktreePath,
        encoding: 'utf8',
        timeout: 3000,
      }).trim();

      execFileSync(
        'git',
        ['checkout', branchName, '--', filePath],
        { cwd: repoRoot, timeout: 10000 },
      );
      this.logger.log(`단일 파일 병합 완료: ${filePath}`);
      return { success: true, message: `${filePath} 병합이 완료되었습니다.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`단일 파일 병합 실패 (${filePath}): ${msg}`);
      return { success: false, message: msg };
    }
  }

  // ─── 조회 ─────────────────────────────────────────────────────────────

  async getLatestRunId(taskId: string): Promise<number | null> {
    const row = await this.changelogRepo.findOne({
      where: { taskId },
      order: { runId: 'DESC' },
      select: ['runId'],
    });
    return row?.runId ?? null;
  }

  async getByTask(taskId: string, runId?: number): Promise<AgentChangelog[]> {
    const targetRunId = runId ?? (await this.getLatestRunId(taskId));

    const rows = await this.changelogRepo.find({
      where: targetRunId != null ? { taskId, runId: targetRunId } : { taskId },
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
