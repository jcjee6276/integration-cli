import { existsSync, mkdirSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

// 컴파일 후 이 파일은 <packageRoot>/packages/cli/dist/utils 에 위치한다.
export function getPackageRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

export const JI_HOME = path.join(os.homedir(), '.ji');

const RUNTIME_DIRS = [
  '',
  'logs',
  'worktrees',
  'patches',
  'harness',
  path.join('agents', 'gemini'),
  path.join('agents', 'codex'),
];

export function ensureRuntimeDirs(): void {
  for (const dir of RUNTIME_DIRS) {
    const target = path.join(JI_HOME, dir);
    if (!existsSync(target)) mkdirSync(target, { recursive: true });
  }
}
