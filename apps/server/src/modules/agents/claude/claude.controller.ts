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

import { ClaudeAuthManager } from './claude-auth.manager';
import type { AuthStatus } from './claude-auth.manager';
import { ClaudeService } from './claude.service';
import type { ClaudeStatus } from './claude.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendInputDto } from './dto/send-input.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/claude')
export class ClaudeController {
  constructor(
    private readonly claudeService: ClaudeService,
    private readonly authManager: ClaudeAuthManager,
  ) {}

  /** GET /agents/claude/auth/status — Claude Code 인증 상태 확인 */
  @Get('auth/status')
  getAuthStatus(): Promise<AuthStatus> {
    return this.authManager.getAuthStatus();
  }

  /** GET /agents/claude/status — 버전·인증·세션 통합 상태 */
  @Get('status')
  getStatus(): Promise<ClaudeStatus> {
    return this.claudeService.getStatus();
  }

  /** POST /agents/claude/sessions — 새 세션 생성 */
  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto): SessionInfo {
    return this.claudeService.createSession(dto);
  }

  /** GET /agents/claude/sessions — 세션 목록 */
  @Get('sessions')
  listSessions(): SessionInfo[] {
    return this.claudeService.listSessions();
  }

  /** GET /agents/claude/sessions/:id — 세션 정보 */
  @Get('sessions/:id')
  getSession(@Param('id') id: string): SessionInfo {
    return this.claudeService.getSession(id);
  }

  /**
   * POST /agents/claude/sessions/:id/message
   * 메시지를 전송하고 claude를 실행한다.
   * 응답은 WebSocket session:text / session:result 이벤트로 수신.
   */
  @Post('sessions/:id/message')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendMessage(@Param('id') id: string, @Body() dto: SendInputDto): void {
    this.claudeService.sendMessage(id, dto.input);
  }

  /** DELETE /agents/claude/sessions/:id — 세션 종료 */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminateSession(@Param('id') id: string): void {
    this.claudeService.terminateSession(id);
  }
}
