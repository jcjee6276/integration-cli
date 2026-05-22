import { execSync } from 'child_process';
import * as os from 'os';

import chalk from 'chalk';

interface ToolStatus {
  name: string;
  cmd: string;
  pkg: string;
  version: string | null;
  installed: boolean;
}

function getPlatform(): 'mac' | 'windows' | 'linux' {
  const p = os.platform();
  if (p === 'darwin') return 'mac';
  if (p === 'win32') return 'windows';
  return 'linux';
}

function isCommandAvailable(cmd: string): boolean {
  const check = getPlatform() === 'windows' ? `where ${cmd}` : `which ${cmd}`;
  try {
    execSync(check, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd: string): string | null {
  try {
    return execSync(`${cmd} --version`, { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

export function runCheck(): void {
  const platform = getPlatform();

  console.log(chalk.bold('\n🔍 설치 상태 확인\n'));

  const tools: Array<{ name: string; cmd: string; pkg: string }> = [
    { name: 'Claude Code', cmd: platform === 'windows' ? 'claude.cmd' : 'claude', pkg: '@anthropic-ai/claude-code' },
    { name: 'Gemini CLI',  cmd: platform === 'windows' ? 'gemini.cmd' : 'gemini',  pkg: '@google/gemini-cli' },
    { name: 'Codex',       cmd: platform === 'windows' ? 'codex.cmd'  : 'codex',   pkg: '@openai/codex' },
  ];

  const results: ToolStatus[] = tools.map(({ name, cmd, pkg }) => {
    const installed = isCommandAvailable(cmd.replace('.cmd', ''));
    return {
      name,
      cmd,
      pkg,
      installed,
      version: installed ? getVersion(cmd) : null,
    };
  });

  for (const r of results) {
    if (r.installed) {
      console.log(chalk.green(`  ✓ ${r.name.padEnd(14)} ${r.version ?? ''}`));
    } else {
      console.log(chalk.red(`  ✗ ${r.name.padEnd(14)} 미설치`));
      console.log(chalk.gray(`      설치: npm install -g ${r.pkg}`));
    }
  }

  const allInstalled = results.every((r) => r.installed);
  console.log();
  if (allInstalled) {
    console.log(chalk.bold.green('모든 도구가 설치되어 있습니다.'));
  } else {
    const missing = results.filter((r) => !r.installed).map((r) => r.name);
    console.log(chalk.yellow(`미설치 도구: ${missing.join(', ')}`));
    console.log(chalk.gray('  jccli init 으로 한 번에 설치할 수 있습니다.'));
  }
  console.log();
}
