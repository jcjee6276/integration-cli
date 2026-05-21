import { Controller, Get, Param, Query } from '@nestjs/common';

import { SessionService } from './session.service';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /** GET /sessions?agentType=claude — agentType 필터 (없으면 전체) */
  @Get()
  findAll(@Query('agentType') agentType?: string) {
    return this.sessionService.findAll(agentType);
  }

  /** GET /sessions/:sessionId — 단건 조회 */
  @Get(':sessionId')
  findOne(@Param('sessionId') sessionId: string) {
    return this.sessionService.findOne(sessionId);
  }
}
