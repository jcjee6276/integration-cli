import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

@ApiTags('fs')
@Controller('fs')
export class FsController {
  @ApiOperation({ summary: '하위 디렉토리 목록 조회' })
  @Get('dirs')
  listDirs(@Query('path') inputPath?: string) {
    const target = inputPath
      ? path.resolve(inputPath.replace(/^~(?=\/|$)/, os.homedir()))
      : os.homedir();

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
}
