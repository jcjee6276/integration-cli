import {
  BadRequestException,
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

import { ConfigureAuthDto } from './dto/configure-auth.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendInputDto } from './dto/send-input.dto';
import { GeminiAuthManager } from './gemini-auth.manager';
import type { GeminiAuthStatus } from './gemini-auth.manager';
import { GeminiSessionManager } from './gemini-session.manager';
import type { SessionInfo } from './interfaces/gemini-session.interface';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/gemini')
export class GeminiController {
  constructor(
    private readonly authManager: GeminiAuthManager,
    private readonly sessionManager: GeminiSessionManager,
  ) {}

  // ─── Auth ─────────────────────────────────────────────────────────────────

  /** GET /agents/gemini/auth/status */
  @Get('auth/status')
  getAuthStatus(): Promise<GeminiAuthStatus> {
    return this.authManager.getAuthStatus();
  }

  /** POST /agents/gemini/auth/configure — API 키 저장 */
  @Post('auth/configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  configureAuth(@Body() dto: ConfigureAuthDto): void {
    if (dto.authType === 'api-key') {
      if (!dto.apiKey?.trim()) throw new BadRequestException('apiKey is required');
      this.authManager.saveApiKey(dto.apiKey.trim());
    }
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  /** POST /agents/gemini/sessions */
  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto): SessionInfo {
    return this.sessionManager.createSession(dto.workingDirectory);
  }

  /** GET /agents/gemini/sessions */
  @Get('sessions')
  listSessions(): SessionInfo[] {
    return this.sessionManager.listSessions();
  }

  /** GET /agents/gemini/sessions/:id */
  @Get('sessions/:id')
  getSession(@Param('id') id: string): SessionInfo {
    return this.sessionManager.getSessionInfo(id);
  }

  /** POST /agents/gemini/sessions/:id/message */
  @Post('sessions/:id/message')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendMessage(@Param('id') id: string, @Body() dto: SendInputDto): void {
    this.sessionManager.sendMessage(id, dto.input);
  }

  /** DELETE /agents/gemini/sessions/:id */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminateSession(@Param('id') id: string): void {
    this.sessionManager.terminateSession(id);
  }
}
