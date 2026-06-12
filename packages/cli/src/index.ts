#!/usr/bin/env node
import { Command } from 'commander';

import { runInit } from './commands/init';
import { runCheck } from './commands/check';
import { runStart } from './commands/start';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 단축 플래그 처리
  if (args.includes('--init')) {
    await runInit({ skipAgents: args.includes('--skip-agents') });
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
    .version('0.2.0');

  program
    .command('init')
    .description('~/.ji 데이터 디렉터리를 준비하고 Claude Code, Gemini CLI, Codex 설치 상태를 확인합니다')
    .option('--skip-agents', '에이전트 CLI 설치 확인을 건너뜁니다')
    .action(async (options: { skipAgents?: boolean }) => {
      await runInit({ skipAgents: options.skipAgents });
    });

  program
    .command('start')
    .description('서버와 웹 앱을 실행하고 단일 포트(기본 3020)에서 서비스합니다')
    .option('-p, --port <port>', '서비스 포트', '3020')
    .action(async (options: { port?: string }) => {
      await runStart({ port: options.port });
    });

  program
    .command('check')
    .description('Claude Code, Gemini CLI, Codex 설치 상태를 확인합니다')
    .action(() => {
      runCheck();
    });

  program.addHelpText(
    'after',
    '\nExamples:\n  jccli init\n  jccli start\n  jccli start --port 4000\n  jccli check\n',
  );

  if (args.length === 0) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
