import * as os from 'os';

import chalk from 'chalk';
import ora from 'ora';

import { ensureRuntimeDirs, JI_HOME } from '../utils/package-root';
import {
  AGENT_TOOLS,
  MIN_NODE_MAJOR,
  findWindowsGitBashPath,
  getCommandVersion,
  getNodeMajorVersion,
  getNpmCommand,
  getPlatform,
  installGlobalPackage,
  isCommandAvailable,
  type AgentTool,
  type SupportedPlatform,
} from '../utils/agent-tools';

export interface RunInitOptions {
  skipAgents?: boolean;
}

export async function runInit(options: RunInitOptions = {}): Promise<void> {
  const platform = getPlatform();
  const failures: string[] = [];

  console.log(chalk.bold('\n🚀 jccli init - 환경 초기화\n'));
  console.log(chalk.gray(`플랫폼: ${platform} (${os.arch()})`));
  console.log(chalk.gray(`Node.js: ${process.version}\n`));

  if (!validateNodeVersion()) {
    process.exitCode = 1;
    return;
  }

  if (!validateNpm(platform)) {
    process.exitCode = 1;
    return;
  }

  try {
    ensureRuntimeDirs();
    console.log(chalk.green(`✓ 데이터 디렉터리 준비: ${JI_HOME}\n`));
  } catch (error) {
    console.error(chalk.red(`✗ 데이터 디렉터리(${JI_HOME})를 만들 수 없습니다.`));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
    return;
  }

  if (options.skipAgents) {
    printSummary([], platform);
    return;
  }

  printWindowsClaudeNotice(platform);

  for (const tool of AGENT_TOOLS) {
    const ok = ensureToolInstalled(tool, platform);
    if (!ok) failures.push(tool.name);
  }

  printSummary(failures, platform);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function validateNodeVersion(): boolean {
  const nodeMajor = getNodeMajorVersion();
  if (nodeMajor >= MIN_NODE_MAJOR) {
    console.log(chalk.green(`✓ Node.js ${process.version}`));
    return true;
  }

  console.error(
    chalk.red(`✗ Node.js v${MIN_NODE_MAJOR}+ 이상이 필요합니다. 현재: ${process.version}`),
  );
  console.error(chalk.yellow('  https://nodejs.org 에서 최신 Node.js를 설치해 주세요.'));
  return false;
}

function validateNpm(platform: SupportedPlatform): boolean {
  if (!isCommandAvailable('npm', platform)) {
    console.error(chalk.red('✗ npm이 설치되어 있지 않습니다.'));
    console.error(chalk.yellow('  Node.js 재설치 또는 npm을 먼저 설치해 주세요.'));
    return false;
  }

  const npmVersion = getCommandVersion(getNpmCommand(platform), platform) ?? 'unknown';
  console.log(chalk.green(`✓ npm v${npmVersion}\n`));
  return true;
}

function printWindowsClaudeNotice(platform: SupportedPlatform): void {
  if (platform !== 'windows') return;

  const gitBashPath = findWindowsGitBashPath();
  if (gitBashPath) {
    console.log(chalk.gray(`Claude Code Git Bash 감지: ${gitBashPath}\n`));
    return;
  }

  console.log(chalk.yellow('Claude Code는 Windows 네이티브 실행 시 Git for Windows가 필요할 수 있습니다.'));
  console.log(chalk.gray('  설치 후에도 claude 실행이 실패하면 Git for Windows를 설치하거나'));
  console.log(chalk.gray('  CLAUDE_CODE_GIT_BASH_PATH 환경 변수를 bash.exe 경로로 설정해 주세요.\n'));
}

function ensureToolInstalled(
  tool: AgentTool,
  platform: SupportedPlatform,
): boolean {
  console.log(chalk.bold(`[ ${tool.name} ]`));

  if (isCommandAvailable(tool.command, platform)) {
    const version = getCommandVersion(tool.command, platform) ?? 'version unknown';
    console.log(chalk.green(`✓ 이미 설치됨: ${version}\n`));
    return true;
  }

  console.log(chalk.yellow(`  미설치 상태입니다. ${tool.packageName} 설치를 시작합니다.`));

  const spinner = ora({
    text: `${tool.packageName} 전역 설치 중...`,
    color: 'cyan',
  }).start();
  const result = installGlobalPackage(tool.packageName, platform);

  if (!result.ok) {
    spinner.fail('설치 실패');
    printInstallError(result.stderr, result.error, tool, platform);
    return false;
  }

  spinner.succeed('설치 완료');

  const verifySpinner = ora('설치 확인 중...').start();
  if (!isCommandAvailable(tool.command, platform)) {
    verifySpinner.fail(`${tool.command} 명령을 찾을 수 없습니다.`);
    console.log(chalk.yellow('  새 터미널을 열거나 PATH 설정을 확인해 주세요.\n'));
    return false;
  }

  const version = getCommandVersion(tool.command, platform) ?? 'version unknown';
  verifySpinner.succeed(`${tool.name} 설치 확인: ${version}`);
  console.log();
  return true;
}

function printInstallError(
  stderr: string,
  error: string | undefined,
  tool: AgentTool,
  platform: SupportedPlatform,
): void {
  console.error(chalk.red('\n설치 중 오류가 발생했습니다:'));
  if (stderr) console.error(chalk.red(stderr));
  if (error) console.error(chalk.red(error));

  console.error(chalk.yellow('\n수동 설치 명령:'));
  console.error(chalk.gray(`  npm install -g ${tool.packageName}`));

  if (platform === 'windows' && tool.requiresWindowsGitBash) {
    console.error(chalk.gray('  Claude Code 실행에는 Git for Windows 또는 WSL이 필요할 수 있습니다.'));
  }

  if (platform !== 'windows') {
    console.error(chalk.gray('  권한 오류가 나면 npm global prefix 또는 Node 설치 방식을 확인해 주세요.'));
  }

  console.log();
}

function printSummary(failures: string[], platform: SupportedPlatform): void {
  if (failures.length === 0) {
    console.log(chalk.bold.green('초기화가 완료되었습니다.\n'));
    console.log(chalk.cyan('어디서든 다음 명령으로 실행할 수 있습니다:'));
    console.log(chalk.gray('  jccli start   # http://localhost:3020'));
    console.log();
    console.log(chalk.cyan('에이전트 CLI 직접 실행:'));
    console.log(chalk.gray('  claude   # Claude Code'));
    console.log(chalk.gray('  gemini   # Gemini CLI'));
    console.log(chalk.gray('  codex    # OpenAI Codex\n'));

    if (platform !== 'windows') {
      console.log(chalk.yellow('명령을 찾을 수 없으면 터미널을 다시 열거나 셸 설정을 다시 로드해 주세요.'));
      console.log(chalk.gray('  source ~/.zshrc  # 또는 ~/.bashrc\n'));
    }
    return;
  }

  console.log(chalk.bold.yellow('일부 에이전트 CLI 설치 또는 확인에 실패했습니다.'));
  console.log(chalk.yellow(`실패 항목: ${failures.join(', ')}`));
  console.log(chalk.gray('위 안내에 따라 수동 설치 또는 PATH 설정을 확인해 주세요.\n'));
}
