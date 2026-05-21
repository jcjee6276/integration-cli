#!/usr/bin/env node
import { Command } from 'commander';

import { runInit } from './commands/init';
import { runCheck } from './commands/check';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 단축 플래그 처리
  if (args.includes('--init') || args[0] === 'init') {
    await runInit();
    return;
  }
  if (args.includes('--check') || args[0] === 'check') {
    runCheck();
    return;
  }

  const program = new Command();

  program
    .name('jccli')
    .description('Claude Code & Gemini CLI web integration CLI')
    .version('0.1.0');

  program
    .command('init')
    .description('Claude Code, Gemini CLI, Codex를 설치하고 환경을 초기화합니다')
    .action(async () => {
      await runInit();
    });

  program
    .command('check')
    .description('Claude Code, Gemini CLI, Codex 설치 상태를 확인합니다')
    .action(() => {
      runCheck();
    });

  program.addHelpText(
    'after',
    '\nExamples:\n  jccli --init\n  jccli init\n  jccli check\n',
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
