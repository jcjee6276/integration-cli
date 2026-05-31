import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { CodexAuthManager } from './codex-auth.manager';
import { CodexSessionManager } from './codex-session.manager';
import type { CodexSessionInfo } from './codex-session.manager';
import { ConfigureCodexAuthDto } from './dto/configure-auth.dto';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/codex')
export class CodexController {
  constructor(
    private readonly authManager: CodexAuthManager,
    private readonly sessionManager: CodexSessionManager,
  ) {}

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

  /** POST /agents/codex/sessions */
  @Post('sessions')
  createSession(@Body() body: { workingDirectory?: string; model?: string; reasoning?: string }): CodexSessionInfo {
    return this.sessionManager.createSession(body.workingDirectory, body.model, body.reasoning);
  }

  /** GET /agents/codex/sessions */
  @Get('sessions')
  listSessions(): CodexSessionInfo[] {
    return this.sessionManager.listSessions();
  }

  /** GET /agents/codex/sessions/:id */
  @Get('sessions/:id')
  getSession(@Param('id') id: string): CodexSessionInfo {
    return this.sessionManager.getSession(id);
  }

  /** DELETE /agents/codex/sessions/:id */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminateSession(@Param('id') id: string): void {
    this.sessionManager.terminateSession(id);
  }
}
