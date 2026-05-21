import { Module } from '@nestjs/common';

import { ClaudeModule } from './claude/claude.module';
import { CodexModule } from './codex/codex.module';
import { GeminiModule } from './gemini/gemini.module';

@Module({
  imports: [ClaudeModule, GeminiModule, CodexModule],
  exports: [ClaudeModule, GeminiModule, CodexModule],
})
export class AgentsModule {}
