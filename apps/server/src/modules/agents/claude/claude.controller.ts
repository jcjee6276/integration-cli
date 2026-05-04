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

import { ClaudeService } from './claude.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ResizeSessionDto } from './dto/resize-session.dto';
import { SendInputDto } from './dto/send-input.dto';
import type { SessionInfo } from './interfaces/claude-session.interface';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('agents/claude')
export class ClaudeController {
  constructor(private readonly claudeService: ClaudeService) {}

  /**
   * POST /agents/claude/sessions
   * 새 Claude CLI 세션을 PTY로 시작한다.
   */
  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto): SessionInfo {
    return this.claudeService.createSession(dto);
  }

  /**
   * GET /agents/claude/sessions
   * 현재 활성 세션 목록을 반환한다.
   */
  @Get('sessions')
  listSessions(): SessionInfo[] {
    return this.claudeService.listSessions();
  }

  /**
   * GET /agents/claude/sessions/:id
   * 특정 세션의 정보를 반환한다.
   */
  @Get('sessions/:id')
  getSession(@Param('id') id: string): SessionInfo {
    return this.claudeService.getSession(id);
  }

  /**
   * GET /agents/claude/sessions/:id/buffer
   * 세션의 출력 버퍼(최근 500줄)를 반환한다.
   * WebSocket 없이 최신 상태를 확인할 때 사용한다.
   */
  @Get('sessions/:id/buffer')
  getOutputBuffer(@Param('id') id: string): { sessionId: string; lines: string[] } {
    return { sessionId: id, lines: this.claudeService.getOutputBuffer(id) };
  }

  /**
   * POST /agents/claude/sessions/:id/input
   * PTY에 텍스트를 직접 전송한다.
   */
  @Post('sessions/:id/input')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendInput(@Param('id') id: string, @Body() dto: SendInputDto): void {
    this.claudeService.sendInput(id, dto.input);
  }

  /**
   * POST /agents/claude/sessions/:id/line
   * PTY에 한 줄(\r 포함)을 전송한다. 명령어 실행에 편리하다.
   */
  @Post('sessions/:id/line')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendLine(@Param('id') id: string, @Body() dto: SendInputDto): void {
    this.claudeService.sendLine(id, dto.input);
  }

  /**
   * POST /agents/claude/sessions/:id/resize
   * PTY 터미널 크기를 변경한다.
   */
  @Post('sessions/:id/resize')
  @HttpCode(HttpStatus.NO_CONTENT)
  resize(@Param('id') id: string, @Body() dto: ResizeSessionDto): void {
    this.claudeService.resize(id, dto);
  }

  /**
   * DELETE /agents/claude/sessions/:id
   * PTY 프로세스를 종료하고 세션을 삭제한다.
   */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminateSession(@Param('id') id: string): void {
    this.claudeService.terminateSession(id);
  }
}
