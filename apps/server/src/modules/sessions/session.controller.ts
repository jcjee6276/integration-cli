import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { SessionService } from './session.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiOperation({ summary: 'DB 저장 세션 목록 조회' })
  @ApiQuery({ name: 'agentType', required: false, enum: ['claude', 'gemini'], description: '에이전트 필터' })
  @ApiOkResponse({ description: '세션 목록' })
  @Get()
  findAll(@Query('agentType') agentType?: string) {
    return this.sessionService.findAll(agentType);
  }

  @ApiOperation({ summary: 'DB 저장 세션 단건 조회' })
  @ApiOkResponse({ description: '세션 정보' })
  @Get(':sessionId')
  findOne(@Param('sessionId') sessionId: string) {
    return this.sessionService.findOne(sessionId);
  }
}
