import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { StartInspectorDto } from './dto/start-inspector.dto';
import { InspectorService } from './inspector.service';

@ApiTags('inspector')
@Controller('inspector')
export class InspectorController {
  constructor(private readonly inspectorService: InspectorService) {}

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
}
