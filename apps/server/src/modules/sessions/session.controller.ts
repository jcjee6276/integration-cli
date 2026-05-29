import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { SessionService } from './session.service';

class UpdateTitleDto {
  @IsString()
  @IsNotEmpty()
  title!: string;
}

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

  @ApiOperation({ summary: '세션 타이틀 수정' })
  @ApiOkResponse({ description: '수정된 세션 정보' })
  @Patch(':sessionId/title')
  @HttpCode(HttpStatus.OK)
  updateTitle(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateTitleDto,
  ) {
    return this.sessionService.updateTitle(sessionId, dto.title);
  }
}
