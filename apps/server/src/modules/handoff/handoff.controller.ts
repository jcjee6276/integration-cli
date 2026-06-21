import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';

import { CreateAgentHandoffDto } from './dto/create-agent-handoff.dto';
import { HandoffService } from './handoff.service';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('handoff')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  @Post('agent')
  create(@Body() dto: CreateAgentHandoffDto) {
    return this.handoffService.create(dto);
  }
}
