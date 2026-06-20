import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

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

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_NODES = 1200;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const EXCLUDED_DIRS = new Set(['.git', '.next', '.turbo', '.vercel', 'node_modules']);

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
}
