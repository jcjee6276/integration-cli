import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';

import { FsService } from './fs.service';

interface OpenFileBody {
  path?: string;
  projectPath?: string;
  line?: number;
  column?: number;
}

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

  @ApiOperation({ summary: '파일 내용 조회' })
  @Get('file')
  async getFile(@Query('path') inputPath?: string) {
    try {
      return await this.fsService.readFileContent(inputPath);
    } catch {
      return this.fsService.readFileContent(inputPath);
    }
  }

  @ApiOperation({ summary: '파일을 로컬 IDE에서 열기' })
  @Post('file/open')
  async openFile(@Body() body: OpenFileBody) {
    try {
      return await this.fsService.openFileInIde(
        body.path,
        body.projectPath,
        Number(body.line),
        Number(body.column),
      );
    } catch {
      return this.fsService.openFileInIde(body.path, body.projectPath);
    }
  }
}
