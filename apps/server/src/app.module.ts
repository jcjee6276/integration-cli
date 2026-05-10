import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AgentsModule } from './modules/agents/agents.module';

@Module({
  imports: [DatabaseModule, AgentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
