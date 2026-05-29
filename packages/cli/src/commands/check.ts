import * as os from 'os';

import chalk from 'chalk';

import {
  AGENT_TOOLS,
  findWindowsGitBashPath,
  getCommandVersion,
  getPlatform,
  isCommandAvailable,
  type AgentTool,
  type SupportedPlatform,
} from '../utils/agent-tools';

interface ToolStatus {
  name: string;
  packageName: string;
  version: string | null;
  installed: boolean;
}

export function runCheck(): void {
  const platform = getPlatform();
  const results = AGENT_TOOLS.map((tool) => getToolStatus(tool, platform));

  console.log(chalk.bold('\n🔍 에이전트 CLI 설치 상태 확인\n'));
  console.log(chalk.gray(`플랫폼: ${platform} (${os.arch()})\n`));

  for (const result of results) {
    if (result.installed) {
      console.log(chalk.green(`  ✓ ${result.name.padEnd(14)} ${result.version ?? ''}`));
      continue;
    }

    console.log(chalk.red(`  ✗ ${result.name.padEnd(14)} 미설치`));
    console.log(chalk.gray(`      설치: npm install -g ${result.packageName}`));
  }

  printWindowsClaudeNotice(platform);
  printSummary(results);
}

function getToolStatus(tool: AgentTool, platform: SupportedPlatform): ToolStatus {
  const installed = isCommandAvailable(tool.command, platform);

  return {
    name: tool.name,
    packageName: tool.packageName,
    installed,
    version: installed ? getCommandVersion(tool.command, platform) : null,
  };
}

function printWindowsClaudeNotice(platform: SupportedPlatform): void {
  if (platform !== 'windows') return;

  const gitBashPath = findWindowsGitBashPath();
  if (gitBashPath) {
    console.log(chalk.gray(`\nClaude Code Git Bash 감지: ${gitBashPath}`));
    return;
  }

  console.log(chalk.yellow('\nClaude Code 실행에는 Git for Windows 또는 WSL이 필요할 수 있습니다.'));
}

function printSummary(results: ToolStatus[]): void {
  const missing = results.filter((result) => !result.installed);

  console.log();
  if (missing.length === 0) {
    console.log(chalk.bold.green('모든 도구가 설치되어 있습니다.'));
  } else {
    console.log(chalk.yellow(`미설치 도구: ${missing.map((result) => result.name).join(', ')}`));
    console.log(chalk.gray('  jccli init 으로 한 번에 설치할 수 있습니다.'));
  }
  console.log();
}
