import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ConversationModule } from './modules/conversations/conversation.module';

@Module({
  imports: [DatabaseModule, AgentsModule, ConversationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
