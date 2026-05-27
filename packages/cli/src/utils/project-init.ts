import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

import chalk from 'chalk';
import ora from 'ora';

import { getNpmCommand, type CommandResult, type SupportedPlatform } from './agent-tools';

export interface InitProjectOptions {
  targetDir?: string;
  force?: boolean;
  skipInstall?: boolean;
}

export interface ProjectReadyResult {
  ok: boolean;
  projectRoot: string;
}

const PROJECT_MARKER_WORKSPACES = ['apps/*', 'packages/*'];
const RUNTIME_DIRS = [
  '.ji',
  path.join('.ji', 'logs'),
  path.join('.ji', 'worktrees'),
  path.join('.ji', 'harness'),
  path.join('.ji', 'agents'),
  path.join('.ji', 'agents', 'gemini'),
  path.join('.ji', 'agents', 'codex'),
];

const COPY_EXCLUDES = new Set([
  '.git',
  '.claude',
  '.turbo',
  'node_modules',
  '.next',
  'out',
  'coverage',
  '.env',
  '.env.local',
]);

const COPY_EXCLUDED_SUFFIXES = [
  path.normalize('apps/server/dist'),
  path.normalize('apps/web/.next'),
  path.normalize('apps/web/out'),
  path.normalize('packages/typescript-config/dist'),
];

export function ensureProjectReady(
  options: InitProjectOptions,
  platform: SupportedPlatform,
): ProjectReadyResult {
  try {
    const cwdProjectRoot = findProjectRoot(process.cwd());
    const targetRoot = resolveTargetRoot(options.targetDir, cwdProjectRoot);

    if (!cwdProjectRoot || path.resolve(cwdProjectRoot) !== path.resolve(targetRoot)) {
      const scaffoldOk = scaffoldProject(targetRoot, Boolean(options.force));
      if (!scaffoldOk) return { ok: false, projectRoot: targetRoot };
    } else {
      console.log(chalk.green(`✓ 프로젝트 감지: ${cwdProjectRoot}`));
    }

    ensureRuntimeDirs();

    if (options.skipInstall) {
      console.log(chalk.yellow('프로젝트 의존성 설치를 건너뜁니다.\n'));
      return { ok: true, projectRoot: targetRoot };
    }

    const installOk = ensureDependencies(targetRoot, platform);
    return { ok: installOk, projectRoot: targetRoot };
  } catch (error) {
    console.error(chalk.red('프로젝트 초기화 중 오류가 발생했습니다.'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return { ok: false, projectRoot: process.cwd() };
  }
}

function resolveTargetRoot(targetDir: string | undefined, cwdProjectRoot: string | null): string {
  if (targetDir) {
    return path.resolve(process.cwd(), targetDir);
  }

  return cwdProjectRoot ?? process.cwd();
}

function findProjectRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    if (isProjectRoot(current)) return current;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function isProjectRoot(dir: string): boolean {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!existsSync(packageJsonPath)) return false;

  try {
    const packageJson = require(packageJsonPath) as { workspaces?: string[] };
    const workspaces = packageJson.workspaces ?? [];
    return PROJECT_MARKER_WORKSPACES.every((workspace) => workspaces.includes(workspace));
  } catch {
    return false;
  }
}

function scaffoldProject(targetRoot: string, force: boolean): boolean {
  const sourceRoot = getTemplateRoot();

  if (!isDirectoryUsableForScaffold(targetRoot, force)) {
    console.error(chalk.red(`대상 폴더가 비어 있지 않습니다: ${targetRoot}`));
    console.error(chalk.gray('  빈 폴더에서 실행하거나 jccli init <folder> 를 사용해 주세요.'));
    console.error(chalk.gray('  기존 파일 위에 복사하려면 --force 옵션을 사용할 수 있습니다.'));
    return false;
  }

  mkdirSync(targetRoot, { recursive: true });

  const spinner = ora({
    text: `프로젝트 파일 복사 중: ${targetRoot}`,
    color: 'cyan',
  }).start();

  try {
    copyDirectory(sourceRoot, targetRoot, sourceRoot);
    spinner.succeed('프로젝트 파일 복사 완료');
    return true;
  } catch (error) {
    spinner.fail('프로젝트 파일 복사 실패');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return false;
  }
}

function getTemplateRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function isDirectoryUsableForScaffold(targetRoot: string, force: boolean): boolean {
  if (!existsSync(targetRoot)) return true;
  if (!statSync(targetRoot).isDirectory()) return false;
  if (force) return true;

  return readdirSync(targetRoot).filter((entry) => entry !== '.DS_Store').length === 0;
}

function copyDirectory(sourceDir: string, targetDir: string, sourceRoot: string): void {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const relativePath = path.relative(sourceRoot, sourcePath);

    if (shouldSkipCopy(entry.name, relativePath)) continue;

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, sourceRoot);
      continue;
    }

    if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function shouldSkipCopy(entryName: string, relativePath: string): boolean {
  if (COPY_EXCLUDES.has(entryName)) return true;
  if (entryName.endsWith('.log')) return true;
  if (entryName.endsWith('.tsbuildinfo')) return true;
  if (/^\.env\..*\.local$/.test(entryName)) return true;

  const normalized = path.normalize(relativePath);
  return COPY_EXCLUDED_SUFFIXES.some((suffix) => normalized === suffix || normalized.startsWith(`${suffix}${path.sep}`));
}

function ensureRuntimeDirs(): void {
  const home = os.homedir();

  try {
    for (const dir of RUNTIME_DIRS) {
      mkdirSync(path.join(home, dir), { recursive: true });
    }
    console.log(chalk.green(`✓ 런타임 디렉터리 준비: ${path.join(home, '.ji')}`));
  } catch (error) {
    console.error(chalk.red('런타임 디렉터리를 만들 수 없습니다.'));
    throw error;
  }
}

function ensureDependencies(projectRoot: string, platform: SupportedPlatform): boolean {
  if (existsSync(path.join(projectRoot, 'node_modules'))) {
    console.log(chalk.green('✓ 프로젝트 의존성 설치 확인: node_modules 감지\n'));
    return true;
  }

  const spinner = ora({
    text: '프로젝트 의존성 설치 중...',
    color: 'cyan',
  }).start();
  const result = runNpmInstall(projectRoot, platform);

  if (result.ok) {
    spinner.succeed('프로젝트 의존성 설치 완료');
    console.log();
    return true;
  }

  spinner.fail('프로젝트 의존성 설치 실패');
  if (result.stderr) console.error(chalk.red(result.stderr));
  if (result.error) console.error(chalk.red(result.error));
  console.error(chalk.yellow('\n수동 설치 명령:'));
  console.error(chalk.gray(`  cd ${projectRoot}`));
  console.error(chalk.gray('  npm install\n'));
  return false;
}

function runNpmInstall(projectRoot: string, platform: SupportedPlatform): CommandResult {
  try {
    const result = spawnSync(getNpmCommand(platform), ['install'], {
      cwd: projectRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: platform === 'windows',
      windowsHide: true,
    });

    return {
      ok: result.status === 0 && !result.error,
      stdout: result.stdout?.trim() ?? '',
      stderr: result.stderr?.trim() ?? '',
      error: result.error?.message,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: '',
      error: error instanceof Error ? error.message : 'Unknown npm install error',
    };
  }
}
