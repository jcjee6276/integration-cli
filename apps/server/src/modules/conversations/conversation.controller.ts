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

import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('conversations')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @ApiOperation({ summary: '대화 메시지 저장' })
  @ApiOkResponse({ description: '저장된 대화 레코드' })
  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversationService.create(dto);
  }

  @ApiOperation({ summary: '세션의 전체 대화 조회' })
  @ApiOkResponse({ description: '대화 목록 (시간순)' })
  @Get('session/:sessionId')
  findBySession(@Param('sessionId') sessionId: string) {
    return this.conversationService.findBySession(sessionId);
  }

  @ApiOperation({ summary: '대화 단건 조회' })
  @ApiOkResponse({ description: '대화 레코드' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationService.findOne(id);
  }

  @ApiOperation({ summary: '대화 단건 삭제' })
  @ApiNoContentResponse({ description: '삭제 완료 (응답 본문 없음)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.conversationService.remove(id);
  }

  @ApiOperation({ summary: '세션 전체 대화 삭제' })
  @ApiNoContentResponse({ description: '삭제 완료 (응답 본문 없음)' })
  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBySession(@Param('sessionId') sessionId: string) {
    return this.conversationService.removeBySession(sessionId);
  }
}
