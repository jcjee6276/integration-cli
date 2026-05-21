import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentChangelogEntity } from './entities/agent-changelog.entity';
import { AgentSessionEntity } from './entities/agent-session.entity';
import { ConversationEntity } from './entities/conversation.entity';
import { SessionEntity } from './entities/session.entity';
import { TaskAgentEntity } from './entities/task-agent.entity';
import { TaskRequirementEntity } from './entities/task-requirement.entity';
import { TaskEntity } from './entities/task.entity';

const DB_DIR = path.join(os.homedir(), '.ji');
const DB_PATH = path.join(DB_DIR, 'ji.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: DB_PATH,
      entities: [SessionEntity, AgentSessionEntity, ConversationEntity, TaskEntity, TaskRequirementEntity, TaskAgentEntity, AgentChangelogEntity],
      synchronize: true,
    }),
  ],
})
export class DatabaseModule {}
