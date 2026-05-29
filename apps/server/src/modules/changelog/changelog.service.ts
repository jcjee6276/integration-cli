import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JI_PATHS } from '../../common/ji-paths';
import { AgentChangelogEntity, ChangeType } from '../../database/entities/agent-changelog.entity';

interface ParsedFile {
  filePath: string;
  changeType: ChangeType;
  patch: string;
  fullPatch: string;
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
    patchPath: string | null;
  }>;
}

interface MergeResult {
  success: boolean;
  message: string;
}

@Injectable()
export class GitChangelogService {
  private readonly logger = new Logger(GitChangelogService.name);

  constructor(
    @InjectRepository(AgentChangelogEntity)
    private readonly changelogRepo: Repository<AgentChangelogEntity>,
  ) {}

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

  getRepoRoot(dir: string): string {
    return execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf8', timeout: 3000 }).trim();
  }

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

    const relativeSubDir = path.relative(repoRoot, workingDir);
    const agentWorkDir = relativeSubDir ? path.join(worktreePath, relativeSubDir) : worktreePath;

    this.logger.log(`Worktree created: ${worktreePath} (branch: ${branchName}, agentDir: ${agentWorkDir})`);
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
      this.logger.log(`Worktree removed: ${worktreePath} (branch: ${branchName})`);
    } catch (err) {
      this.logger.warn(`Failed to remove worktree (ignored): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async captureAndSave(
    taskId: string,
    agentId: number,
    worktreePath: string,
    startCommitHash: string,
    commitMessage: string,
    runId?: number,
  ): Promise<string | null> {
    try {
      execSync('git add -A', { cwd: worktreePath, stdio: 'ignore', timeout: 10000 });

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

      const diffOutput = execSync(`git diff "${startCommitHash}"..HEAD`, {
        cwd: worktreePath,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30000,
      });

      if (!diffOutput.trim()) {
        this.logger.log(`Agent ${agentId}: no changes`);
        return snapshotSha;
      }

      const files = this.parseDiff(diffOutput);
      if (files.length) {
        await this.changelogRepo.save(
          files.map((f, index) => {
            const patchPath = this.writePatchFile(taskId, agentId, runId, f.filePath, f.fullPatch, index);
            return this.changelogRepo.create({
              taskId,
              agentId,
              runId: runId ?? null,
              filePath: f.filePath,
              changeType: f.changeType,
              patch: f.patch,
              patchPath,
              additions: f.additions,
              deletions: f.deletions,
            });
          }),
        );
        this.logger.log(`Agent ${agentId}: saved ${files.length} changelog file(s)`);
      }

      return snapshotSha;
    } catch (err) {
      this.logger.warn(`Agent ${agentId} changelog capture failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  mergeToMain(mainRepoDir: string, snapshotSha: string, agentId: number): void {
    try {
      execSync(
        `git -c core.hooksPath=/dev/null merge --no-ff "${snapshotSha}" -m "chore: apply agent-${agentId} changes"`,
        { cwd: mainRepoDir, stdio: 'ignore', timeout: 30000 },
      );
      this.logger.log(`Agent ${agentId}: merged snapshot ${snapshotSha.slice(0, 7)}`);
    } catch (err) {
      this.logger.warn(`Agent ${agentId}: merge conflict; changelog remains available. ${err instanceof Error ? err.message : String(err)}`);
      try {
        execSync('git merge --abort', { cwd: mainRepoDir, stdio: 'ignore', timeout: 5000 });
      } catch {}
    }
  }

  mergeAll(worktreePath: string, workingDir: string): MergeResult {
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
      this.logger.log(`Merged branch ${branchName} into ${repoRoot}`);
      return { success: true, message: '전체 병합이 완료되었습니다.' };
    } catch (err) {
      try {
        const repoRoot = this.getRepoRoot(workingDir);
        execFileSync('git', ['merge', '--abort'], { cwd: repoRoot });
      } catch {}
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Merge failed: ${msg}`);
      return { success: false, message: msg };
    }
  }

  mergeFile(worktreePath: string, workingDir: string, filePath: string): MergeResult {
    if (!fs.existsSync(worktreePath)) {
      return { success: false, message: `worktree 경로가 존재하지 않습니다: ${worktreePath}` };
    }

    try {
      const safeFilePath = this.normalizeGitPathspec(filePath);
      const repoRoot = this.getRepoRoot(workingDir);
      const branchName = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: worktreePath,
        encoding: 'utf8',
        timeout: 3000,
      }).trim();

      execFileSync('git', ['checkout', branchName, '--', safeFilePath], {
        cwd: repoRoot,
        timeout: 10000,
      });
      this.logger.log(`Merged file from worktree: ${safeFilePath}`);
      return { success: true, message: `${safeFilePath} 병합이 완료되었습니다.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`File merge failed (${filePath}): ${msg}`);
      return { success: false, message: msg };
    }
  }

  async mergeAllFromChangelog(taskId: string, agentId: number, workingDir: string): Promise<MergeResult> {
    try {
      const rows = await this.findLatestAgentRows(taskId, agentId);
      if (!rows.length) {
        return { success: false, message: '저장된 changelog patch가 없습니다.' };
      }

      const patchText = this.buildPatchText(rows);
      if (!patchText) {
        return { success: false, message: '저장된 changelog patch가 없거나 잘려 있습니다.' };
      }

      const repoRoot = this.getRepoRoot(workingDir);
      this.applyPatchText(repoRoot, patchText);
      return { success: true, message: '저장된 changelog patch를 적용했습니다.' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Stored changelog merge failed: ${msg}`);
      return { success: false, message: msg };
    }
  }

  async mergeFileFromChangelog(taskId: string, agentId: number, workingDir: string, filePath: string): Promise<MergeResult> {
    try {
      const safeFilePath = this.normalizeGitPathspec(filePath);
      const rows = await this.findLatestAgentRows(taskId, agentId);
      const row = rows.find((entry) => entry.filePath === safeFilePath);

      if (!row) {
        return { success: false, message: '이 파일의 저장된 changelog patch가 없습니다.' };
      }

      const patchText = this.readStoredPatch(row);
      if (!patchText) {
        return { success: false, message: '저장된 changelog patch가 없거나 잘려 있습니다.' };
      }

      const repoRoot = this.getRepoRoot(workingDir);
      this.applyPatchText(repoRoot, patchText);
      return { success: true, message: `${safeFilePath} 파일에 저장된 changelog patch를 적용했습니다.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Stored changelog file merge failed (${filePath}): ${msg}`);
      return { success: false, message: msg };
    }
  }

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
        patchPath: row.patchPath,
      });
    }

    return Array.from(byAgent.values());
  }

  private async findLatestAgentRows(taskId: string, agentId: number): Promise<AgentChangelogEntity[]> {
    const targetRunId = await this.getLatestRunId(taskId);
    return this.changelogRepo.find({
      where: targetRunId != null ? { taskId, agentId, runId: targetRunId } : { taskId, agentId },
      order: { id: 'ASC' },
    });
  }

  private buildPatchText(rows: AgentChangelogEntity[]): string | null {
    const patches: string[] = [];
    for (const row of rows) {
      const patchText = this.readStoredPatch(row);
      if (!patchText) return null;
      patches.push(patchText.trimEnd());
    }
    return patches.length ? `${patches.join('\n')}\n` : null;
  }

  private readStoredPatch(row: AgentChangelogEntity): string | null {
    try {
      if (row.patchPath && fs.existsSync(row.patchPath)) {
        return fs.readFileSync(row.patchPath, 'utf8');
      }

      if (row.patch && !row.patch.includes('\n... (truncated)')) {
        return row.patch;
      }

      return null;
    } catch (err) {
      this.logger.warn(`Failed to read stored patch ${row.patchPath ?? row.id}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private applyPatchText(repoRoot: string, patchText: string): void {
    const tempPath = path.join(JI_PATHS.patches, `.apply-${Date.now()}-${Math.random().toString(36).slice(2)}.patch`);
    try {
      fs.mkdirSync(JI_PATHS.patches, { recursive: true });
      fs.writeFileSync(tempPath, patchText, 'utf8');
      execFileSync('git', ['apply', '--index', '--whitespace=nowarn', tempPath], {
        cwd: repoRoot,
        timeout: 30000,
      });
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
    }
  }

  private writePatchFile(
    taskId: string,
    agentId: number,
    runId: number | undefined,
    filePath: string,
    patchText: string,
    index: number,
  ): string {
    const runSegment = runId != null ? `run-${runId}` : 'run-unversioned';
    const dir = path.join(
      JI_PATHS.patches,
      this.toPathSegment(taskId),
      runSegment,
      `agent-${agentId}`,
    );
    const filename = `${String(index + 1).padStart(3, '0')}-${this.toPathSegment(filePath).slice(0, 96)}.patch`;
    const patchPath = path.join(dir, filename);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(patchPath, patchText, 'utf8');
    return patchPath;
  }

  private toPathSegment(value: string): string {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return sanitized || 'item';
  }

  private normalizeGitPathspec(filePath: string): string {
    const normalized = path.posix.normalize(filePath.replace(/\\/g, '/'));

    if (
      !filePath.trim() ||
      normalized === '.' ||
      normalized === '..' ||
      normalized.startsWith('../') ||
      path.posix.isAbsolute(normalized)
    ) {
      throw new Error(`유효하지 않은 파일 경로입니다: ${filePath}`);
    }

    return normalized;
  }

  private parseDiff(diff: string): ParsedFile[] {
    const files: ParsedFile[] = [];
    const sections = diff.split(/^diff --git /m).filter(Boolean);

    for (const section of sections) {
      const full = `diff --git ${section}`;
      const lines = section.split('\n');
      const header = lines[0] ?? '';
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
        patch: full.length > 200_000 ? `${full.slice(0, 200_000)}\n... (truncated)` : full,
        fullPatch: full,
        additions,
        deletions,
      });
    }

    return files;
  }
}
