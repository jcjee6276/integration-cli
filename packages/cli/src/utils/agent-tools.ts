import { existsSync } from 'fs';
import * as os from 'os';
import { spawnSync } from 'child_process';

export type SupportedPlatform = 'mac' | 'windows' | 'linux';

export interface AgentTool {
  name: string;
  command: string;
  packageName: string;
  requiresWindowsGitBash?: boolean;
}

export interface CommandLookup {
  command: string;
  path: string;
}

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export const MIN_NODE_MAJOR = 18;

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'Claude Code',
    command: 'claude',
    packageName: '@anthropic-ai/claude-code',
    requiresWindowsGitBash: true,
  },
  {
    name: 'Gemini CLI',
    command: 'gemini',
    packageName: '@google/gemini-cli',
  },
  {
    name: 'Codex',
    command: 'codex',
    packageName: '@openai/codex',
  },
];

export function getPlatform(): SupportedPlatform {
  const platform = os.platform();
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

export function getNodeMajorVersion(): number {
  return Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
}

export function getNpmCommand(platform: SupportedPlatform): string {
  return platform === 'windows' ? 'npm.cmd' : 'npm';
}

export function resolveCommand(
  command: string,
  platform: SupportedPlatform = getPlatform(),
): CommandLookup | null {
  try {
    if (platform === 'windows') {
      const candidates = command.match(/\.(cmd|exe|bat)$/i)
        ? [command]
        : [command, `${command}.cmd`, `${command}.exe`];

      for (const candidate of candidates) {
        const result = spawnSync('where.exe', [candidate], {
          encoding: 'utf8',
          windowsHide: true,
        });
        const path = result.stdout
          ?.split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);

        if (result.status === 0 && path) {
          return { command, path };
        }
      }

      return null;
    }

    const result = spawnSync('sh', ['-lc', `command -v ${quoteForPosixShell(command)}`], {
      encoding: 'utf8',
    });
    const path = result.stdout.trim().split(/\r?\n/)[0];

    if (result.status === 0 && path) {
      return { command, path };
    }

    return null;
  } catch {
    return null;
  }
}

export function isCommandAvailable(
  command: string,
  platform: SupportedPlatform = getPlatform(),
): boolean {
  return resolveCommand(command, platform) !== null;
}

export function runCommand(
  command: string,
  args: string[],
  platform: SupportedPlatform = getPlatform(),
  timeout = 5000,
): CommandResult {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      shell: platform === 'windows',
      timeout,
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
      error: error instanceof Error ? error.message : 'Unknown command error',
    };
  }
}

export function getCommandVersion(
  command: string,
  platform: SupportedPlatform = getPlatform(),
): string | null {
  const result = runCommand(command, ['--version'], platform);
  if (!result.ok) return null;

  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || null;
}

export function installGlobalPackage(
  packageName: string,
  platform: SupportedPlatform = getPlatform(),
): CommandResult {
  try {
    const result = spawnSync(getNpmCommand(platform), ['install', '-g', packageName], {
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

export function findWindowsGitBashPath(): string | null {
  if (getPlatform() !== 'windows') return null;

  const fromPath = resolveCommand('bash', 'windows');
  if (fromPath) return fromPath.path;

  const candidates = [
    process.env.CLAUDE_CODE_GIT_BASH_PATH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ].filter((value): value is string => Boolean(value));

  try {
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  } catch {
    return null;
  }
}

function quoteForPosixShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
