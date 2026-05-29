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
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ClaudeAuthManager } from './claude-auth.manager';
import type { AuthStatus } from './claude-auth.manager';
import { ClaudeService } from './claude.service';
import type { ClaudeStatus } from './claude.service';
import { ClaudeCreateSessionDto as CreateSessionDto } from './dto/create-session.dto';
import { SendInputDto } from './dto/send-input.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

@ApiTags('agents/claude')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/claude')
export class ClaudeController {
  constructor(
    private readonly claudeService: ClaudeService,
    private readonly authManager: ClaudeAuthManager,
  ) {}

  @ApiOperation({ summary: 'Claude Code 인증 상태 조회' })
  @ApiOkResponse({ description: '인증 상태 반환' })
  @Get('auth/status')
  getAuthStatus(): Promise<AuthStatus> {
    return this.authManager.getAuthStatus();
  }

  @ApiOperation({ summary: 'Claude Code 통합 상태 조회 (버전·인증·세션 수)' })
  @ApiOkResponse({ description: '버전, 플랫폼, 인증, 활성 세션 수' })
  @Get('status')
  getStatus(): Promise<ClaudeStatus> {
    return this.claudeService.getStatus();
  }

  @ApiOperation({ summary: '새 Claude 세션 생성' })
  @ApiOkResponse({ description: '생성된 세션 정보' })
  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto): SessionInfo {
    return this.claudeService.createSession(dto);
  }

  @ApiOperation({ summary: '활성 Claude 세션 목록 조회' })
  @ApiOkResponse({ description: '세션 목록' })
  @Get('sessions')
  listSessions(): SessionInfo[] {
    return this.claudeService.listSessions();
  }

  @ApiOperation({ summary: '특정 Claude 세션 조회' })
  @ApiOkResponse({ description: '세션 정보' })
  @Get('sessions/:id')
  getSession(@Param('id') id: string): SessionInfo {
    return this.claudeService.getSession(id);
  }

  @ApiOperation({
    summary: '세션에 메시지 전송',
    description: '응답은 WebSocket `/agents/claude` 네임스페이스의 `session:text` / `session:result` 이벤트로 수신',
  })
  @ApiNoContentResponse({ description: '전송 완료 (응답 본문 없음)' })
  @Post('sessions/:id/message')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendMessage(@Param('id') id: string, @Body() dto: SendInputDto): void {
    this.claudeService.sendMessage(id, dto.input);
  }

  @ApiOperation({ summary: '세션 종료' })
  @ApiNoContentResponse({ description: '종료 완료 (응답 본문 없음)' })
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminateSession(@Param('id') id: string): void {
    this.claudeService.terminateSession(id);
  }
}
