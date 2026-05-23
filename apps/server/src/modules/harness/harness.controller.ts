import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, UsePipes, ValidationPipe } from '@nestjs/common';

import { HarnessService } from './harness.service';
import { SaveHarnessDto } from './dto/save-harness.dto';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('harness')
export class HarnessController {
  constructor(private readonly harnessService: HarnessService) {}

  /** GET /harness */
  @Get()
  findAll() {
    return this.harnessService.findAll();
  }

  /** GET /harness/:role */
  @Get(':role')
  findOne(@Param('role') role: string) {
    return this.harnessService.findOne(role) ?? { role, ext: 'md', content: '' };
  }

  /** PUT /harness/:role */
  @Put(':role')
  save(@Param('role') role: string, @Body() dto: SaveHarnessDto) {
    return this.harnessService.save(role, dto.content, dto.ext);
  }

  /** DELETE /harness/:role */
  @Delete(':role')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('role') role: string) {
    this.harnessService.remove(role);
  }
}
