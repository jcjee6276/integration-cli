import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ensureJiDirs, JI_PATHS } from '../common/ji-paths';
import { AgentChangelogEntity } from './entities/agent-changelog.entity';
import { AgentSessionEntity } from './entities/agent-session.entity';
import { ConversationEntity } from './entities/conversation.entity';
import { SessionEntity } from './entities/session.entity';
import { TaskAgentEntity } from './entities/task-agent.entity';
import { TaskAgentRunEntity } from './entities/task-agent-run.entity';
import { TaskRequirementEntity } from './entities/task-requirement.entity';
import { TaskEntity } from './entities/task.entity';
import { TaskRunEntity } from './entities/task-run.entity';

ensureJiDirs();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: JI_PATHS.db,
      entities: [SessionEntity, AgentSessionEntity, ConversationEntity, TaskEntity, TaskRequirementEntity, TaskAgentEntity, TaskRunEntity, TaskAgentRunEntity, AgentChangelogEntity],
      synchronize: true,
    }),
  ],
})
export class DatabaseModule {}
