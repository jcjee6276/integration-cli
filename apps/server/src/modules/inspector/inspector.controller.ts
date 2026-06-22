import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CrawlService } from './crawl.service';
import { CrawlDto } from './dto/crawl.dto';
import { StartInspectorDto } from './dto/start-inspector.dto';
import { InspectorService } from './inspector.service';

@ApiTags('inspector')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('inspector')
export class InspectorController {
  constructor(
    private readonly inspectorService: InspectorService,
    private readonly crawlService: CrawlService,
  ) {}

  @ApiOperation({ summary: '인스펙터 세션 시작 (Chrome 기동 + overlay 주입)' })
  @Post('session/start')
  async start(@Body() dto: StartInspectorDto) {
    return this.inspectorService.start(dto.appUrl);
  }

  @ApiOperation({ summary: '인스펙터 세션 종료' })
  @HttpCode(HttpStatus.OK)
  @Post('session/stop')
  async stop() {
    await this.inspectorService.stop();
    return { state: this.inspectorService.getState() };
  }

  @ApiOperation({ summary: '라우트 크롤 감사 — 콘솔 에러·예외·실패 요청 수집' })
  @Post('crawl')
  async crawl(@Body() dto: CrawlDto) {
    return this.crawlService.crawl(dto.appUrl, dto.projectPath, dto.routes);
  }

  @ApiOperation({ summary: '프로젝트 경로에서 라우트 자동 발견' })
  @HttpCode(HttpStatus.OK)
  @Post('crawl/routes')
  discoverRoutes(@Body() dto: CrawlDto) {
    return { routes: dto.projectPath ? this.crawlService.discoverRoutes(dto.projectPath) : ['/'] };
  }
}
