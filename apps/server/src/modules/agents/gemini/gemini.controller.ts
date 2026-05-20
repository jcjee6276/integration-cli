import { Controller, Get } from '@nestjs/common';

import { GeminiAuthManager } from './gemini-auth.manager';
import type { GeminiAuthStatus } from './gemini-auth.manager';

@Controller('agents/gemini')
export class GeminiController {
  constructor(private readonly authManager: GeminiAuthManager) {}

  /** GET /agents/gemini/auth/status — Gemini CLI 인증 상태 확인 */
  @Get('auth/status')
  getAuthStatus(): Promise<GeminiAuthStatus> {
    return this.authManager.getAuthStatus();
  }
}
