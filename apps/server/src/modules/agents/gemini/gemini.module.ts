import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentSessionEntity } from '../../../database/entities/agent-session.entity';
import { SessionEntity } from '../../../database/entities/session.entity';
import { GeminiAuthManager } from './gemini-auth.manager';
import { GeminiController } from './gemini.controller';
import { GeminiGateway } from './gemini.gateway';
import { GeminiSessionManager } from './gemini-session.manager';

@Module({
  imports: [TypeOrmModule.forFeature([AgentSessionEntity, SessionEntity])],
  controllers: [GeminiController],
  providers: [GeminiAuthManager, GeminiSessionManager, GeminiGateway],
  exports: [GeminiSessionManager, GeminiAuthManager],
})
export class GeminiModule {}
