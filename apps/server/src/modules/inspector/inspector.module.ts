import { Module } from '@nestjs/common';

import { ConsoleCollectorService } from './console-collector.service';
import { InspectorController } from './inspector.controller';
import { InspectorGateway } from './inspector.gateway';
import { InspectorService } from './inspector.service';
import { NetworkCollectorService } from './network-collector.service';
import { SourceResolverService } from './source-resolver.service';

@Module({
  controllers: [InspectorController],
  providers: [
    InspectorService,
    InspectorGateway,
    SourceResolverService,
    NetworkCollectorService,
    ConsoleCollectorService,
  ],
})
export class InspectorModule {}
