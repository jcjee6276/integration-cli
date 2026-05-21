import { Module } from '@nestjs/common';

import { CodexAuthManager } from './codex-auth.manager';
import { CodexController } from './codex.controller';

@Module({
  controllers: [CodexController],
  providers: [CodexAuthManager],
  exports: [CodexAuthManager],
})
export class CodexModule {}
