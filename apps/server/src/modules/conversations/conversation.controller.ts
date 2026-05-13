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

import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  /** POST /conversations — 대화 메시지 저장 */
  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversationService.create(dto);
  }

  /** GET /conversations/session/:sessionId — 세션 전체 대화 조회 */
  @Get('session/:sessionId')
  findBySession(@Param('sessionId') sessionId: string) {
    return this.conversationService.findBySession(sessionId);
  }

  /** GET /conversations/:id — 단건 조회 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationService.findOne(id);
  }

  /** DELETE /conversations/:id — 단건 삭제 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.conversationService.remove(id);
  }

  /** DELETE /conversations/session/:sessionId — 세션 전체 삭제 */
  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBySession(@Param('sessionId') sessionId: string) {
    return this.conversationService.removeBySession(sessionId);
  }
}
