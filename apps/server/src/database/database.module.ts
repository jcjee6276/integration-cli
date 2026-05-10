import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionEntity } from './entities/session.entity';

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
      entities: [SessionEntity],
      synchronize: true,
    }),
  ],
})
export class DatabaseModule {}
