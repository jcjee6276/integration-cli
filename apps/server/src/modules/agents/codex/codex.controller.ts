import { Body, Controller, Get, HttpCode, HttpStatus, Post, UsePipes, ValidationPipe } from '@nestjs/common';

import { CodexAuthManager } from './codex-auth.manager';
import { ConfigureCodexAuthDto } from './dto/configure-auth.dto';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/codex')
export class CodexController {
  constructor(private readonly authManager: CodexAuthManager) {}

  /** GET /agents/codex/auth/status */
  @Get('auth/status')
  getAuthStatus() {
    return this.authManager.getAuthStatus();
  }

  /** POST /agents/codex/auth/configure */
  @Post('auth/configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  configureAuth(@Body() dto: ConfigureCodexAuthDto): void {
    this.authManager.saveApiKey(dto.apiKey.trim());
  }
}
