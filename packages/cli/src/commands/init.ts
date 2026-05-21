import { execSync, spawnSync } from 'child_process';
import * as os from 'os';

import chalk from 'chalk';
import ora from 'ora';

const CLAUDE_CODE_PACKAGE = '@anthropic-ai/claude-code';
const GEMINI_CLI_PACKAGE = '@google/gemini-cli';
const CODEX_PACKAGE = '@openai/codex';
const MIN_NODE_MAJOR = 18;

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

function getNodeMajorVersion(): number {
  return parseInt(process.versions.node.split('.')[0], 10);
}

function getNpmInstallCmd(pkg: string): [string, string[]] {
  const platform = getPlatform();
  if (platform === 'windows') {
    return ['npm.cmd', ['install', '-g', pkg]];
  }
  return ['npm', ['install', '-g', pkg]];
}

function installPackage(pkg: string, platform: 'mac' | 'windows' | 'linux'): boolean {
  const [cmd, args] = getNpmInstallCmd(pkg);
  const spinner = ora({
    text: `${pkg} 전역 설치 중...`,
    color: 'cyan',
  }).start();

  const result = spawnSync(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: platform === 'windows',
  });

  if (result.status !== 0) {
    spinner.fail('설치 실패');
    console.error(chalk.red('\n설치 중 오류가 발생했습니다:'));
    if (result.stderr) console.error(chalk.red(result.stderr));
    if (result.error) console.error(chalk.red(result.error.message));

    if (platform !== 'windows') {
      console.error(chalk.yellow('\n권한 오류인 경우 sudo를 사용하거나 npm prefix를 변경해 보세요:'));
      console.error(chalk.gray(`  sudo npm install -g ${pkg}`));
    }
    return false;
  }

  spinner.succeed('설치 완료');
  return true;
}

export async function runInit(): Promise<void> {
  const platform = getPlatform();

  console.log(chalk.bold('\n🚀 jccli init — Claude Code & Gemini CLI 설치\n'));
  console.log(chalk.gray(`플랫폼: ${platform} (${os.arch()})`));
  console.log(chalk.gray(`Node.js: ${process.version}\n`));

  // Node.js 버전 확인
  const nodeMajor = getNodeMajorVersion();
  if (nodeMajor < MIN_NODE_MAJOR) {
    console.error(
      chalk.red(
        `✗ Node.js v${MIN_NODE_MAJOR}+ 이상이 필요합니다. 현재: ${process.version}`,
      ),
    );
    console.error(
      chalk.yellow('  https://nodejs.org 에서 최신 Node.js를 설치해 주세요.'),
    );
    process.exit(1);
  }
  console.log(chalk.green(`✓ Node.js ${process.version}`));

  // npm 확인
  const npmCmd = platform === 'windows' ? 'npm.cmd' : 'npm';
  if (!isCommandAvailable('npm')) {
    console.error(chalk.red('✗ npm이 설치되어 있지 않습니다.'));
    console.error(chalk.yellow('  Node.js 재설치 또는 npm을 먼저 설치해 주세요.'));
    process.exit(1);
  }

  let npmVersion = 'unknown';
  try {
    npmVersion = execSync(`${npmCmd} --version`, { encoding: 'utf8' }).trim();
  } catch {}
  console.log(chalk.green(`✓ npm v${npmVersion}\n`));

  // ── Claude Code ───────────────────────────────────────────────
  console.log(chalk.bold('[ Claude Code ]'));
  const claudeCmd = platform === 'windows' ? 'claude.cmd' : 'claude';
  if (isCommandAvailable('claude')) {
    let claudeVersion = 'unknown';
    try {
      claudeVersion = execSync(`${claudeCmd} --version`, { encoding: 'utf8' }).trim();
    } catch {}
    console.log(chalk.green(`✓ 이미 설치됨: ${claudeVersion}`));
  } else {
    console.log(chalk.yellow('  설치되어 있지 않습니다. 설치를 시작합니다...'));
    const ok = installPackage(CLAUDE_CODE_PACKAGE, platform);
    if (!ok) process.exit(1);

    const verifySpinner = ora('설치 확인 중...').start();
    if (isCommandAvailable('claude')) {
      let installedVersion = 'unknown';
      try {
        installedVersion = execSync(`${claudeCmd} --version`, { encoding: 'utf8' }).trim();
      } catch {}
      verifySpinner.succeed(`Claude Code 설치 확인: ${installedVersion}`);
    } else {
      verifySpinner.warn('claude 명령어를 찾을 수 없습니다. PATH를 확인해 주세요.');
    }
  }

  // ── Gemini CLI ────────────────────────────────────────────────
  console.log(chalk.bold('\n[ Gemini CLI ]'));
  const geminiCmd = platform === 'windows' ? 'gemini.cmd' : 'gemini';
  if (isCommandAvailable('gemini')) {
    let geminiVersion = 'unknown';
    try {
      geminiVersion = execSync(`${geminiCmd} --version`, { encoding: 'utf8' }).trim();
    } catch {}
    console.log(chalk.green(`✓ 이미 설치됨: ${geminiVersion}`));
  } else {
    console.log(chalk.yellow('  설치되어 있지 않습니다. 설치를 시작합니다...'));
    const ok = installPackage(GEMINI_CLI_PACKAGE, platform);
    if (!ok) process.exit(1);

    const verifySpinner = ora('설치 확인 중...').start();
    if (isCommandAvailable('gemini')) {
      let installedVersion = 'unknown';
      try {
        installedVersion = execSync(`${geminiCmd} --version`, { encoding: 'utf8' }).trim();
      } catch {}
      verifySpinner.succeed(`Gemini CLI 설치 확인: ${installedVersion}`);
    } else {
      verifySpinner.warn('gemini 명령어를 찾을 수 없습니다. PATH를 확인해 주세요.');
    }
  }

  // ── Codex ─────────────────────────────────────────────────────
  console.log(chalk.bold('\n[ OpenAI Codex ]'));
  const codexCmd = platform === 'windows' ? 'codex.cmd' : 'codex';
  if (isCommandAvailable('codex')) {
    let codexVersion = 'unknown';
    try {
      codexVersion = execSync(`${codexCmd} --version`, { encoding: 'utf8' }).trim();
    } catch {}
    console.log(chalk.green(`✓ 이미 설치됨: ${codexVersion}`));
  } else {
    console.log(chalk.yellow('  설치되어 있지 않습니다. 설치를 시작합니다...'));
    const ok = installPackage(CODEX_PACKAGE, platform);
    if (!ok) process.exit(1);

    const verifySpinner = ora('설치 확인 중...').start();
    if (isCommandAvailable('codex')) {
      let installedVersion = 'unknown';
      try {
        installedVersion = execSync(`${codexCmd} --version`, { encoding: 'utf8' }).trim();
      } catch {}
      verifySpinner.succeed(`Codex 설치 확인: ${installedVersion}`);
    } else {
      verifySpinner.warn('codex 명령어를 찾을 수 없습니다. PATH를 확인해 주세요.');
    }
  }

  console.log(chalk.bold('\n✅ 설치가 완료되었습니다!\n'));
  console.log(chalk.cyan('다음 명령어로 시작할 수 있습니다:'));
  console.log(chalk.gray('  claude   # Claude Code'));
  console.log(chalk.gray('  gemini   # Gemini CLI'));
  console.log(chalk.gray('  codex    # OpenAI Codex\n'));

  if (platform !== 'windows') {
    console.log(chalk.yellow('명령어를 찾을 수 없는 경우 터미널을 재시작하거나 다음을 실행해 보세요:'));
    console.log(chalk.gray('  source ~/.zshrc  # 또는 ~/.bashrc\n'));
  }
}
