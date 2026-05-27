#!/usr/bin/env node
import { Command } from 'commander';

import { runInit } from './commands/init';
import { runCheck } from './commands/check';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 단축 플래그 처리
  if (args.includes('--init')) {
    await runInit(parseInitArgs(args));
    return;
  }
  if (args.includes('--check')) {
    runCheck();
    return;
  }

  const program = new Command();

  program
    .name('jccli')
    .description('Claude Code, Gemini CLI, and Codex web integration CLI')
    .version('0.1.0');

  program
    .command('init [dir]')
    .description('프로젝트를 복사/초기화하고 Claude Code, Gemini CLI, Codex 설치 상태를 확인합니다')
    .option('-f, --force', '비어 있지 않은 대상 폴더에도 프로젝트 파일을 복사합니다')
    .option('--skip-install', '프로젝트 npm install을 건너뜁니다')
    .option('--skip-agents', '에이전트 CLI 설치 확인을 건너뜁니다')
    .action(async (dir: string | undefined, options: { force?: boolean; skipInstall?: boolean; skipAgents?: boolean }) => {
      await runInit({
        targetDir: dir,
        force: options.force,
        skipInstall: options.skipInstall,
        skipAgents: options.skipAgents,
      });
    });

  program
    .command('check')
    .description('Claude Code, Gemini CLI, Codex 설치 상태를 확인합니다')
    .action(() => {
      runCheck();
    });

  program.addHelpText(
    'after',
    '\nExamples:\n  jccli --init\n  jccli init\n  jccli init my-app\n  jccli init --skip-install\n  jccli check\n',
  );

  if (args.length === 0) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

function parseInitArgs(args: string[]): {
  targetDir?: string;
  force?: boolean;
  skipInstall?: boolean;
  skipAgents?: boolean;
} {
  const initIndex = args[0] === 'init' ? 1 : 0;
  const positional = args.slice(initIndex).find((arg) => !arg.startsWith('-'));

  return {
    targetDir: positional,
    force: args.includes('--force') || args.includes('-f'),
    skipInstall: args.includes('--skip-install'),
    skipAgents: args.includes('--skip-agents'),
  };
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
