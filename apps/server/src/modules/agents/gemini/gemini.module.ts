import { Module } from '@nestjs/common';

import { GeminiAuthManager } from './gemini-auth.manager';
import { GeminiController } from './gemini.controller';
import { GeminiGateway } from './gemini.gateway';

@Module({
  controllers: [GeminiController],
  providers: [GeminiAuthManager, GeminiGateway],
})
export class GeminiModule {}
