import { Module } from '@nestjs/common';

import { GeminiAuthManager } from './gemini-auth.manager';
import { GeminiController } from './gemini.controller';

@Module({
  controllers: [GeminiController],
  providers: [GeminiAuthManager],
})
export class GeminiModule {}
