import { Module } from '@nestjs/common';

import { ClaudePtyManager } from './claude-pty.manager';
import { ClaudeController } from './claude.controller';
import { ClaudeGateway } from './claude.gateway';
import { ClaudeService } from './claude.service';

@Module({
  controllers: [ClaudeController],
  providers: [ClaudeService, ClaudePtyManager, ClaudeGateway],
  exports: [ClaudeService],
})
export class ClaudeModule {}
