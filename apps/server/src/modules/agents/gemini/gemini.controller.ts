import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { ConfigureAuthDto } from './dto/configure-auth.dto';
import { GeminiAuthManager } from './gemini-auth.manager';
import type { GeminiAuthStatus } from './gemini-auth.manager';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/gemini')
export class GeminiController {
  constructor(private readonly authManager: GeminiAuthManager) {}

  /** GET /agents/gemini/auth/status — Gemini CLI 인증 상태 확인 */
  @Get('auth/status')
  getAuthStatus(): Promise<GeminiAuthStatus> {
    return this.authManager.getAuthStatus();
  }

  /**
   * POST /agents/gemini/auth/configure
   * API 키 저장 (authType: 'api-key', apiKey: '...')
   * GCA는 WebSocket gateway 의 auth:login:start 로 처리
   */
  @Post('auth/configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  configureAuth(@Body() dto: ConfigureAuthDto): void {
    if (dto.authType === 'api-key') {
      if (!dto.apiKey?.trim()) throw new BadRequestException('apiKey is required');
      this.authManager.saveApiKey(dto.apiKey.trim());
    }
  }
}
