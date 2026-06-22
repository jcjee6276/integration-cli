import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

export type FsTreeNodeType = 'directory' | 'file';

export interface FsTreeNode {
  name: string;
  path: string;
  type: FsTreeNodeType;
  children?: FsTreeNode[];
  truncated?: boolean;
  error?: string;
}

export interface FsTreeResult {
  root: FsTreeNode;
  maxDepth: number;
  totalNodes: number;
  truncated: boolean;
}

export interface FsFileResult {
  name: string;
  path: string;
  content: string;
  size: number;
  truncated: boolean;
}

export interface FsOpenFileResult {
  ok: boolean;
  path: string;
  opener?: string;
  error?: string;
}

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_NODES = 1200;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const EXCLUDED_DIRS = new Set(['.git', '.next', '.turbo', '.vercel', 'node_modules']);
const execFileAsync = promisify(execFile);

@Injectable()
export class FsService {
  resolveInputPath(inputPath?: string): string {
    try {
      const expanded = inputPath?.trim().replace(/^~(?=\/|$)/, os.homedir());
      return expanded ? path.resolve(expanded) : os.homedir();
    } catch {
      return os.homedir();
    }
  }

  async readDirectoryTree(inputPath?: string, maxDepth = DEFAULT_MAX_DEPTH): Promise<FsTreeResult> {
    const rootPath = this.resolveInputPath(inputPath);
    const safeMaxDepth = this.toSafeDepth(maxDepth);
    const counter = { total: 0, truncated: false };

    try {
      const stat = await fs.stat(rootPath);
      if (!stat.isDirectory()) {
        return {
          root: {
            name: path.basename(rootPath),
            path: rootPath,
            type: 'file',
            error: '디렉토리가 아닙니다',
          },
          maxDepth: safeMaxDepth,
          totalNodes: 1,
          truncated: false,
        };
      }

      const root = await this.readNode(rootPath, 0, safeMaxDepth, counter);
      return {
        root,
        maxDepth: safeMaxDepth,
        totalNodes: counter.total,
        truncated: counter.truncated,
      };
    } catch (err) {
      return {
        root: {
          name: path.basename(rootPath) || rootPath,
          path: rootPath,
          type: 'directory',
          children: [],
          error: err instanceof Error ? err.message : '디렉토리를 읽지 못했습니다',
        },
        maxDepth: safeMaxDepth,
        totalNodes: counter.total,
        truncated: counter.truncated,
      };
    }
  }

  async readFileContent(inputPath?: string): Promise<FsFileResult> {
    const filePath = this.resolveInputPath(inputPath);

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        return {
          name: path.basename(filePath),
          path: filePath,
          content: '',
          size: stat.size,
          truncated: false,
        };
      }

      const handle = await fs.open(filePath, 'r');
      try {
        const length = Math.min(stat.size, DEFAULT_MAX_FILE_BYTES);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, 0);
        return {
          name: path.basename(filePath),
          path: filePath,
          content: buffer.toString('utf8'),
          size: stat.size,
          truncated: stat.size > DEFAULT_MAX_FILE_BYTES,
        };
      } finally {
        await handle.close();
      }
    } catch {
      return {
        name: path.basename(filePath) || filePath,
        path: filePath,
        content: '',
        size: 0,
        truncated: false,
      };
    }
  }

  async openFileInIde(
    inputPath?: string,
    projectPath?: string,
    line?: number,
    column?: number,
  ): Promise<FsOpenFileResult> {
    const filePath = this.resolveInputPath(inputPath);
    const rootPath = projectPath ? this.resolveInputPath(projectPath) : undefined;

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        return { ok: false, path: filePath, error: '파일이 아닙니다' };
      }

      const target = this.formatIdeTarget(filePath, line, column);
      const candidates = this.getIdeOpenCandidates(filePath, target, rootPath, line, column);

      for (const candidate of candidates) {
        try {
          await execFileAsync(candidate.command, candidate.args, { timeout: 5000 });
          await this.focusIde(candidate.label);
          return { ok: true, path: filePath, opener: candidate.label };
        } catch {}
      }

      return { ok: false, path: filePath, error: '파일을 열 수 있는 IDE를 찾지 못했습니다' };
    } catch (err) {
      return {
        ok: false,
        path: filePath,
        error: err instanceof Error ? err.message : '파일을 열지 못했습니다',
      };
    }
  }

  private async readNode(
    targetPath: string,
    depth: number,
    maxDepth: number,
    counter: { total: number; truncated: boolean },
  ): Promise<FsTreeNode> {
    counter.total += 1;

    const node: FsTreeNode = {
      name: path.basename(targetPath) || targetPath,
      path: targetPath,
      type: 'directory',
      children: [],
    };

    if (depth >= maxDepth || counter.total >= DEFAULT_MAX_NODES) {
      node.truncated = true;
      counter.truncated = true;
      return node;
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const visibleEntries = entries
        .filter((entry) => !this.shouldHideEntry(entry.name))
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of visibleEntries) {
        if (counter.total >= DEFAULT_MAX_NODES) {
          node.truncated = true;
          counter.truncated = true;
          break;
        }

        const entryPath = path.join(targetPath, entry.name);

        if (entry.isDirectory()) {
          node.children?.push(await this.readNode(entryPath, depth + 1, maxDepth, counter));
          continue;
        }

        if (entry.isFile()) {
          counter.total += 1;
          node.children?.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
          });
        }
      }

      return node;
    } catch (err) {
      node.error = err instanceof Error ? err.message : '디렉토리를 읽지 못했습니다';
      return node;
    }
  }

  private shouldHideEntry(name: string): boolean {
    try {
      return EXCLUDED_DIRS.has(name) || name.startsWith('.');
    } catch {
      return true;
    }
  }

  private toSafeDepth(depth: number): number {
    try {
      if (!Number.isFinite(depth)) return DEFAULT_MAX_DEPTH;
      return Math.min(Math.max(Math.floor(depth), 1), 20);
    } catch {
      return DEFAULT_MAX_DEPTH;
    }
  }

  private formatIdeTarget(filePath: string, line?: number, column?: number): string {
    try {
      if (!line || line < 1) return filePath;
      if (!column || column < 1) return `${filePath}:${line}`;
      return `${filePath}:${line}:${column}`;
    } catch {
      return filePath;
    }
  }

  private getIdeOpenCandidates(
    filePath: string,
    ideTarget: string,
    projectPath?: string,
    line?: number,
    column?: number,
  ) {
    try {
      const customCommand = process.env.JC_IDE_CMD?.trim();
      const candidates: Array<{ command: string; args: string[]; label: string }> = [];
      const workspaceArgs = projectPath ? [projectPath] : [];
      const jetBrainsLocationArgs = [
        ...(line && line >= 1 ? ['--line', String(line)] : []),
        ...(column && column >= 1 ? ['--column', String(column)] : []),
        filePath,
      ];

      if (customCommand) {
        candidates.push({ command: customCommand, args: [ideTarget], label: customCommand });
      }

      candidates.push(
        {
          command: 'cursor',
          args: ['--reuse-window', ...workspaceArgs, '-g', ideTarget],
          label: 'Cursor',
        },
        {
          command: 'code',
          args: ['--reuse-window', ...workspaceArgs, '-g', ideTarget],
          label: 'VS Code',
        },
        { command: 'idea', args: jetBrainsLocationArgs, label: 'IntelliJ IDEA' },
        { command: 'idea64', args: jetBrainsLocationArgs, label: 'IntelliJ IDEA' },
        { command: 'intellij-idea-ultimate', args: jetBrainsLocationArgs, label: 'IntelliJ IDEA' },
        { command: 'intellij-idea-community', args: jetBrainsLocationArgs, label: 'IntelliJ IDEA' },
      );

      if (process.platform === 'darwin') {
        candidates.push(
          {
            command: 'open',
            args: ['-b', 'com.todesktop.230313mzl4w4u92', filePath],
            label: 'Cursor',
          },
          { command: 'open', args: ['-b', 'com.microsoft.VSCode', filePath], label: 'VS Code' },
          {
            command: 'open',
            args: ['-b', 'com.jetbrains.intellij', filePath],
            label: 'IntelliJ IDEA',
          },
          { command: 'open', args: [filePath], label: 'macOS open' },
        );
      } else if (process.platform === 'win32') {
        candidates.push({
          command: 'cmd',
          args: ['/c', 'start', '', filePath],
          label: 'Windows open',
        });
      } else {
        candidates.push({ command: 'xdg-open', args: [filePath], label: 'xdg-open' });
      }

      return candidates;
    } catch {
      return [];
    }
  }

  private async focusIde(label: string): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        const appName = this.getMacAppName(label);
        if (!appName) return;
        await execFileAsync('osascript', ['-e', `tell application "${appName}" to activate`], {
          timeout: 2000,
        });
        return;
      }

      if (process.platform === 'win32') {
        const windowTitle = this.getWindowsAppTitle(label);
        if (!windowTitle) return;
        await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            `$ws = New-Object -ComObject WScript.Shell; $null = $ws.AppActivate('${windowTitle.replace(/'/g, "''")}')`,
          ],
          { timeout: 2000 },
        );
      }
    } catch {}
  }

  private getMacAppName(label: string): string | null {
    try {
      if (label.includes('Cursor')) return 'Cursor';
      if (label.includes('VS Code')) return 'Visual Studio Code';
      if (label.includes('IntelliJ')) return 'IntelliJ IDEA';
      return null;
    } catch {
      return null;
    }
  }

  private getWindowsAppTitle(label: string): string | null {
    try {
      if (label.includes('Cursor')) return 'Cursor';
      if (label.includes('VS Code')) return 'Visual Studio Code';
      if (label.includes('IntelliJ')) return 'IntelliJ IDEA';
      return null;
    } catch {
      return null;
    }
  }
}
