import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';

import { CreateAgentHandoffDto } from './dto/create-agent-handoff.dto';
import { CreateBatchHandoffDto } from './dto/create-batch-handoff.dto';
import { HandoffService } from './handoff.service';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('handoff')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  @Post('agent')
  create(@Body() dto: CreateAgentHandoffDto) {
    return this.handoffService.create(dto);
  }

  @Post('agent/batch')
  createBatch(@Body() dto: CreateBatchHandoffDto) {
    return this.handoffService.createBatch(dto);
  }
}
