import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaskAgentEntity } from '../../database/entities/task-agent.entity';
import { TaskRequirementEntity } from '../../database/entities/task-requirement.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { GeminiModule } from '../agents/gemini/gemini.module';
import { ConversationModule } from '../conversations/conversation.module';
import { TaskExecutionService } from './task-execution.service';
import { TaskGateway } from './task.gateway';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, TaskRequirementEntity, TaskAgentEntity]),
    GeminiModule,
    ConversationModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskExecutionService, TaskGateway],
  exports: [TasksService],
})
export class TasksModule {}
