import { Controller, Get, Param } from '@nestjs/common';

import { SessionService } from './session.service';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /** GET /sessions — 전체 세션 목록 (최신순) */
  @Get()
  findAll() {
    return this.sessionService.findAll();
  }

  /** GET /sessions/:sessionId — 단건 조회 */
  @Get(':sessionId')
  findOne(@Param('sessionId') sessionId: string) {
    return this.sessionService.findOne(sessionId);
  }
}
