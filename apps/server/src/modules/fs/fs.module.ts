import { Module } from '@nestjs/common';

import { FsCouplingService } from './fs-coupling.service';
import { FsController } from './fs.controller';
import { FsService } from './fs.service';

@Module({
  controllers: [FsController],
  providers: [FsService, FsCouplingService],
  exports: [FsService, FsCouplingService],
})
export class FsModule {}
