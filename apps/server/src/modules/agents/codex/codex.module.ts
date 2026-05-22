import { Module } from '@nestjs/common';

import { CodexAuthManager } from './codex-auth.manager';
import { CodexController } from './codex.controller';
import { CodexGateway } from './codex.gateway';

@Module({
  controllers: [CodexController],
  providers: [CodexAuthManager, CodexGateway],
  exports: [CodexAuthManager],
})
export class CodexModule {}
