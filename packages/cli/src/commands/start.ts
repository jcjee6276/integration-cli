import { existsSync } from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';

import chalk from 'chalk';
import ora from 'ora';

import { ensureRuntimeDirs, getPackageRoot, JI_HOME } from '../utils/package-root';
import { startProxyServer, waitForPort } from '../utils/proxy';

export interface RunStartOptions {
  port?: string;
}

const DEFAULT_PORT = 3020;
const UPSTREAM_READY_TIMEOUT_MS = 120_000;

export async function runStart(options: RunStartOptions = {}): Promise<void> {
  const port = parsePort(options.port);
  if (port === null) {
    console.error(chalk.red(`✗ 잘못된 포트입니다: ${options.port}`));
    process.exitCode = 1;
    return;
  }

  const packageRoot = getPackageRoot();
  const serverEntry = path.join(packageRoot, 'apps', 'server', 'dist', 'main.js');
  const webDir = path.join(packageRoot, 'apps', 'web');
  const webBuildDir = path.join(webDir, '.next');

  if (!existsSync(serverEntry) || !existsSync(webBuildDir)) {
    console.error(chalk.red('✗ 빌드 결과물을 찾을 수 없습니다. 패키지 설치가 손상되었을 수 있습니다.'));
    console.error(chalk.gray('  npm i -g @jcjeon/integration-cli 로 재설치해 주세요.'));
    process.exitCode = 1;
    return;
  }

  const nextBin = resolveNextBin(packageRoot);
  if (!nextBin) {
    console.error(chalk.red('✗ next 런타임을 찾을 수 없습니다. 패키지를 재설치해 주세요.'));
    process.exitCode = 1;
    return;
  }

  try {
    ensureRuntimeDirs();
  } catch (error) {
    console.error(chalk.red(`✗ 런타임 디렉터리(${JI_HOME})를 만들 수 없습니다.`));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
    return;
  }

  const serverPort = port + 1;
  const webPort = port + 2;

  console.log(chalk.bold('\n🚀 jccli start\n'));
  console.log(chalk.gray(`데이터 디렉터리: ${JI_HOME}`));
  console.log(chalk.gray(`포트: ${port} (내부: server ${serverPort}, web ${webPort})\n`));

  const children: ChildProcess[] = [];
  let shuttingDown = false;

  const shutdown = (code: number): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      try {
        child.kill();
      } catch {
        // 이미 종료된 프로세스는 무시
      }
    }
    process.exit(code);
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  try {
    const proxyServer = await startProxyServer({ port, serverPort, webPort });
    proxyServer.on('error', (error) => {
      console.error(chalk.red(`프록시 서버 오류: ${error.message}`));
    });
  } catch (error) {
    console.error(chalk.red(`✗ 포트 ${port} 를 사용할 수 없습니다. 이미 사용 중인지 확인해 주세요.`));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
    return;
  }

  const serverChild = spawnNode({
    label: 'server',
    color: chalk.magenta,
    nodeArgs: [serverEntry],
    cwd: packageRoot,
    env: { PORT: String(serverPort) },
    onExit: (code) => {
      if (!shuttingDown) {
        console.error(chalk.red(`\n[server] 프로세스가 종료되었습니다 (code: ${code ?? 'unknown'})`));
        shutdown(1);
      }
    },
  });
  children.push(serverChild);

  const webChild = spawnNode({
    label: 'web',
    color: chalk.cyan,
    nodeArgs: [nextBin, 'start', '--port', String(webPort)],
    cwd: webDir,
    env: {},
    onExit: (code) => {
      if (!shuttingDown) {
        console.error(chalk.red(`\n[web] 프로세스가 종료되었습니다 (code: ${code ?? 'unknown'})`));
        shutdown(1);
      }
    },
  });
  children.push(webChild);

  const spinner = ora({ text: '서버와 웹 앱을 시작하는 중...', color: 'cyan' }).start();

  const [serverReady, webReady] = await Promise.all([
    waitForPort(serverPort, UPSTREAM_READY_TIMEOUT_MS),
    waitForPort(webPort, UPSTREAM_READY_TIMEOUT_MS),
  ]);

  if (!serverReady || !webReady) {
    spinner.fail('시작 시간 초과');
    const failed = [!serverReady && 'server', !webReady && 'web'].filter(Boolean).join(', ');
    console.error(chalk.red(`✗ 다음 프로세스가 시간 안에 시작되지 않았습니다: ${failed}`));
    console.error(chalk.gray('  위에 출력된 로그를 확인해 주세요.'));
    shutdown(1);
    return;
  }

  spinner.succeed('모든 프로세스 시작 완료');
  console.log();
  console.log(chalk.bold.green(`  ▶ http://localhost:${port}`));
  console.log();
  console.log(chalk.gray('  종료하려면 Ctrl+C 를 누르세요.\n'));
}

function resolveNextBin(packageRoot: string): string | null {
  try {
    return require.resolve('next/dist/bin/next', { paths: [packageRoot] });
  } catch {
    return null;
  }
}

interface SpawnNodeOptions {
  label: string;
  color: (text: string) => string;
  nodeArgs: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onExit: (code: number | null) => void;
}

function spawnNode(options: SpawnNodeOptions): ChildProcess {
  const { label, color, nodeArgs, cwd, env, onExit } = options;

  const child = spawn(process.execPath, nodeArgs, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const prefix = color(`[${label}]`);
  const forward = (chunk: Buffer): void => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim().length === 0) continue;
      console.log(`${prefix} ${line}`);
    }
  };

  child.stdout?.on('data', forward);
  child.stderr?.on('data', forward);
  child.on('exit', onExit);
  child.on('error', (error) => {
    console.error(chalk.red(`[${label}] 실행 오류: ${error.message}`));
    onExit(null);
  });

  return child;
}

function parsePort(value: string | undefined): number | null {
  if (value === undefined) return DEFAULT_PORT;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65533) return null;
  return parsed;
}
