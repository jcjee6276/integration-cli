import { Module } from '@nestjs/common';

import { ClaudeModule } from './claude/claude.module';
import { GeminiModule } from './gemini/gemini.module';

@Module({
  imports: [ClaudeModule, GeminiModule],
  exports: [ClaudeModule, GeminiModule],
})
export class AgentsModule {}
