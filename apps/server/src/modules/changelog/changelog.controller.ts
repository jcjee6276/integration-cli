import { Controller, Get, Param } from '@nestjs/common';

import { GitChangelogService } from './changelog.service';

@Controller('tasks')
export class ChangelogController {
  constructor(private readonly changelogService: GitChangelogService) {}

  /** GET /tasks/:taskId/changelog */
  @Get(':taskId/changelog')
  getChangelog(@Param('taskId') taskId: string) {
    return this.changelogService.getByTask(taskId);
  }

  /** GET /tasks/:taskId/runs/:runId/changelog */
  @Get(':taskId/runs/:runId/changelog')
  getRunChangelog(@Param('taskId') taskId: string, @Param('runId') runId: string) {
    return this.changelogService.getByTask(taskId, Number(runId));
  }
}
