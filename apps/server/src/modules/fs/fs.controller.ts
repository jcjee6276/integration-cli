import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';

import { FsService } from './fs.service';

@ApiTags('fs')
@Controller('fs')
export class FsController {
  constructor(private readonly fsService: FsService) {}

  @ApiOperation({ summary: '하위 디렉토리 목록 조회' })
  @Get('dirs')
  listDirs(@Query('path') inputPath?: string) {
    const target = this.fsService.resolveInputPath(inputPath);

    try {
      const entries = fs.readdirSync(target, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));

      return { path: target, dirs };
    } catch {
      return { path: target, dirs: [] };
    }
  }

  @ApiOperation({ summary: '디렉토리 트리 재귀 조회' })
  @Get('tree')
  async getTree(@Query('path') inputPath?: string, @Query('maxDepth') maxDepth?: string) {
    try {
      return await this.fsService.readDirectoryTree(inputPath, Number(maxDepth));
    } catch {
      return this.fsService.readDirectoryTree(inputPath);
    }
  }
}
