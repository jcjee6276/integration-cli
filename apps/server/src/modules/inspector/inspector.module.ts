import { Module } from '@nestjs/common';

import { InspectorController } from './inspector.controller';
import { InspectorGateway } from './inspector.gateway';
import { InspectorService } from './inspector.service';

@Module({
  controllers: [InspectorController],
  providers: [InspectorService, InspectorGateway],
})
export class InspectorModule {}
