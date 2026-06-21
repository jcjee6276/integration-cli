import { promises as fs } from 'fs';
import * as path from 'path';

import { Injectable } from '@nestjs/common';
import { Project, ts } from 'ts-morph';

import { FsService } from './fs.service';

export interface FsImporterItem {
  path: string;
  name: string;
  relativePath: string;
  line: number;
  column: number;
  importText: string;
}

export interface FsImportersResult {
  rootPath: string;
  targetPath: string;
  importers: FsImporterItem[];
  count: number;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const EXCLUDED_SEGMENTS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
]);

@Injectable()
export class FsCouplingService {
  constructor(private readonly fsService: FsService) {}

  async findImporters(rootInput?: string, targetInput?: string): Promise<FsImportersResult> {
    const rootPath = this.fsService.resolveInputPath(rootInput);
    const targetPath = this.fsService.resolveInputPath(targetInput);

    try {
      const rootStat = await fs.stat(rootPath);
      const targetStat = await fs.stat(targetPath);
      if (!rootStat.isDirectory() || !targetStat.isFile() || !this.isInside(rootPath, targetPath)) {
        return { rootPath, targetPath, importers: [], count: 0 };
      }

      const project = await this.createProject(rootPath, targetPath);
      const targetSource = project.addSourceFileAtPathIfExists(targetPath);
      if (!targetSource) return { rootPath, targetPath, importers: [], count: 0 };

      const targetFilePath = this.normalizePath(targetSource.getFilePath());
      const importers: FsImporterItem[] = [];

      for (const sourceFile of project.getSourceFiles()) {
        try {
          if (!this.shouldScanSource(rootPath, sourceFile.getFilePath())) continue;
          if (this.normalizePath(sourceFile.getFilePath()) === targetFilePath) continue;

          const matches = [
            ...sourceFile.getImportDeclarations(),
            ...sourceFile
              .getExportDeclarations()
              .filter((declaration) => declaration.getModuleSpecifier()),
          ].filter((declaration) => {
            try {
              const resolved = declaration.getModuleSpecifierSourceFile();
              return Boolean(
                resolved && this.normalizePath(resolved.getFilePath()) === targetFilePath,
              );
            } catch {
              return false;
            }
          });

          for (const declaration of matches) {
            const position = sourceFile.getLineAndColumnAtPos(declaration.getStart());
            importers.push({
              path: sourceFile.getFilePath(),
              name: path.basename(sourceFile.getFilePath()),
              relativePath: path.relative(rootPath, sourceFile.getFilePath()),
              line: position.line,
              column: position.column,
              importText: declaration.getText().replace(/\s+/g, ' ').slice(0, 240),
            });
          }
        } catch {}
      }

      importers.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.line - b.line);
      return { rootPath, targetPath, importers, count: importers.length };
    } catch {
      return { rootPath, targetPath, importers: [], count: 0 };
    }
  }

  private async createProject(rootPath: string, targetPath: string): Promise<Project> {
    try {
      const tsConfigFilePath = await this.findTsConfig(rootPath, targetPath);
      if (tsConfigFilePath) {
        const project = new Project({
          tsConfigFilePath,
          compilerOptions: { allowJs: true },
          skipAddingFilesFromTsConfig: true,
          skipFileDependencyResolution: true,
        });
        project.addSourceFilesAtPaths(await this.collectSourceFilePaths(rootPath));
        return project;
      }
    } catch {}

    const project = new Project({
      compilerOptions: {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ESNext,
      },
      skipFileDependencyResolution: true,
    });

    project.addSourceFilesAtPaths(await this.collectSourceFilePaths(rootPath));
    return project;
  }

  private async findTsConfig(rootPath: string, targetPath: string): Promise<string | null> {
    try {
      let current = path.dirname(targetPath);
      while (this.isInside(rootPath, current) || this.normalizePath(current) === rootPath) {
        try {
          const candidate = path.join(current, 'tsconfig.json');
          const stat = await fs.stat(candidate);
          if (stat.isFile()) return candidate;
        } catch {}

        const next = path.dirname(current);
        if (next === current) break;
        current = next;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async collectSourceFilePaths(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const visit = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          try {
            if (entry.name.startsWith('.') || EXCLUDED_SEGMENTS.has(entry.name)) continue;

            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              await visit(entryPath);
              continue;
            }

            if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
              files.push(entryPath);
            }
          } catch {}
        }
      } catch {}
    };

    await visit(rootPath);
    return files;
  }

  private shouldScanSource(rootPath: string, filePath: string): boolean {
    try {
      if (!this.isInside(rootPath, filePath)) return false;
      if (!SOURCE_EXTENSIONS.includes(path.extname(filePath))) return false;
      const relativeSegments = path.relative(rootPath, filePath).split(path.sep);
      return !relativeSegments.some(
        (segment) => EXCLUDED_SEGMENTS.has(segment) || segment.startsWith('.'),
      );
    } catch {
      return false;
    }
  }

  private isInside(rootPath: string, targetPath: string): boolean {
    try {
      const relative = path.relative(rootPath, targetPath);
      return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    } catch {
      return false;
    }
  }

  private normalizePath(filePath: string): string {
    try {
      return path.resolve(filePath);
    } catch {
      return filePath;
    }
  }
}
