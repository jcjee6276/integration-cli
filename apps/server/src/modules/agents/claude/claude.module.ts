import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
import { SessionEntity } from '../../../database/entities/session.entity';
import { ClaudePtyManager } from './claude-pty.manager';
import { ClaudeController } from './claude.controller';
import { ClaudeGateway } from './claude.gateway';
import { ClaudeService } from './claude.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentSessionEntity, SessionEntity])],
  controllers: [ClaudeController],
  providers: [ClaudeService, ClaudePtyManager, ClaudeGateway],
  exports: [ClaudeService],
})
export class ClaudeModule {}
