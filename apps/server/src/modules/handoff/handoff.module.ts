import { Module } from '@nestjs/common';

import { AgentsModule } from '../agents/agents.module';
import { ConversationModule } from '../conversations/conversation.module';
import { HandoffController } from './handoff.controller';
import { HandoffService } from './handoff.service';

@Module({
  imports: [AgentsModule, ConversationModule],
  controllers: [HandoffController],
  providers: [HandoffService],
})
export class HandoffModule {}
