import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { FsModule } from './modules/fs/fs.module';
import { HarnessModule } from './modules/harness/harness.module';
import { InspectorModule } from './modules/inspector/inspector.module';
import { SessionModule } from './modules/sessions/session.module';
import { TasksModule } from './modules/tasks/tasks.module';

@Module({
  imports: [DatabaseModule, AgentsModule, ConversationModule, FsModule, HarnessModule, InspectorModule, SessionModule, TasksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
