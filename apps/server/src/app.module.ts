import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { SessionModule } from './modules/sessions/session.module';

@Module({
  imports: [DatabaseModule, AgentsModule, ConversationModule, SessionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
