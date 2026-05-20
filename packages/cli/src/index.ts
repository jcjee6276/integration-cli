#!/usr/bin/env node
import { Command } from 'commander';

import { runInit } from './commands/init';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Commander 없이 --init 플래그를 직접 처리
  if (args.includes('--init') || args[0] === 'init') {
    await runInit();
    return;
  }

  const program = new Command();

  program
    .name('jccli')
    .description('Claude Code & Gemini CLI web integration CLI')
    .version('0.1.0');

  program
    .command('init')
    .description('Claude Code & Gemini CLI를 설치하고 환경을 초기화합니다')
    .action(async () => {
      await runInit();
    });

  program.addHelpText(
    'after',
    '\nExamples:\n  jccli --init\n  jccli init\n',
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
