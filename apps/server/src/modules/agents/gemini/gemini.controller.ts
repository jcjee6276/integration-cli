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
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ConfigureAuthDto } from './dto/configure-auth.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendInputDto } from './dto/send-input.dto';
import { GeminiAuthManager } from './gemini-auth.manager';
import type { GeminiAuthStatus } from './gemini-auth.manager';
import { GeminiSessionManager } from './gemini-session.manager';
import type { SessionInfo } from './interfaces/gemini-session.interface';

@ApiTags('agents/gemini')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/gemini')
export class GeminiController {
  constructor(
    private readonly authManager: GeminiAuthManager,
    private readonly sessionManager: GeminiSessionManager,
  ) {}

  @ApiOperation({ summary: 'Gemini CLI 인증 상태 조회' })
  @ApiOkResponse({ description: '설치 여부, 인증 방식, 이메일 반환' })
  @Get('auth/status')
  getAuthStatus(): Promise<GeminiAuthStatus> {
    return this.authManager.getAuthStatus();
  }

  @ApiOperation({
    summary: 'Gemini CLI 인증 설정',
    description: '`api-key` 방식은 apiKey 필드 필수. `gca` 방식은 WebSocket으로 진행',
  })
  @ApiNoContentResponse({ description: '설정 완료 (응답 본문 없음)' })
  @Post('auth/configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  configureAuth(@Body() dto: ConfigureAuthDto): void {
    if (dto.authType === 'api-key') {
      if (!dto.apiKey?.trim()) throw new BadRequestException('apiKey is required');
      this.authManager.saveApiKey(dto.apiKey.trim());
    }
  }

  @ApiOperation({ summary: '새 Gemini 세션 생성' })
  @ApiOkResponse({ description: '생성된 세션 정보' })
  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto): SessionInfo {
    return this.sessionManager.createSession(dto.workingDirectory);
  }

  @ApiOperation({ summary: '활성 Gemini 세션 목록 조회' })
  @ApiOkResponse({ description: '세션 목록' })
  @Get('sessions')
  listSessions(): SessionInfo[] {
    return this.sessionManager.listSessions();
  }

  @ApiOperation({ summary: '특정 Gemini 세션 조회' })
  @ApiOkResponse({ description: '세션 정보' })
  @Get('sessions/:id')
  getSession(@Param('id') id: string): SessionInfo {
    return this.sessionManager.getSessionInfo(id);
  }

  @ApiOperation({
    summary: '세션에 메시지 전송',
    description: '응답은 WebSocket `/agents/gemini` 네임스페이스의 `session:chunk` / `session:done` 이벤트로 수신',
  })
  @ApiNoContentResponse({ description: '전송 완료 (응답 본문 없음)' })
  @Post('sessions/:id/message')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendMessage(@Param('id') id: string, @Body() dto: SendInputDto): void {
    this.sessionManager.sendMessage(id, dto.input);
  }

  @ApiOperation({ summary: '세션 종료' })
  @ApiNoContentResponse({ description: '종료 완료 (응답 본문 없음)' })
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminateSession(@Param('id') id: string): void {
    this.sessionManager.terminateSession(id);
  }
}
