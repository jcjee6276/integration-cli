import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
import { SessionEntity } from '../../../database/entities/session.entity';
import { CodexAuthManager } from './codex-auth.manager';
import { CodexController } from './codex.controller';
import { CodexGateway } from './codex.gateway';
import { CodexSessionManager } from './codex-session.manager';

@Module({
  imports: [TypeOrmModule.forFeature([AgentSessionEntity, SessionEntity])],
  controllers: [CodexController],
  providers: [CodexAuthManager, CodexSessionManager, CodexGateway],
  exports: [CodexAuthManager, CodexSessionManager],
})
export class CodexModule {}
