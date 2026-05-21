import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentChangelogEntity } from '../../database/entities/agent-changelog.entity';
import { ChangelogController } from './changelog.controller';
import { GitChangelogService } from './changelog.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentChangelogEntity])],
  controllers: [ChangelogController],
  providers: [GitChangelogService],
  exports: [GitChangelogService],
})
export class ChangelogModule {}
