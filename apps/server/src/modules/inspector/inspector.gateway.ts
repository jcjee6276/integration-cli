import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import type { InspectorElementEvent, InspectorStatusEvent } from './inspector.service';
import { InspectorService } from './inspector.service';

/**
 * WebSocket 프로토콜 (/inspector 네임스페이스)
 *
 * Server → Client
 *   inspector:element  { fileName?, line?, column?, componentName?, notFound?, tagName?, text? }
 *   inspector:status   { state, appUrl?, error? }
 *
 * 단일 전역 세션이라 룸 구분 없이 전체 broadcast.
 */
@WebSocketGateway({ namespace: '/inspector', cors: { origin: '*' } })
export class InspectorGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(InspectorGateway.name);

  constructor(private readonly inspectorService: InspectorService) {}

  afterInit(): void {
    this.inspectorService.on('inspector:element', (e: InspectorElementEvent) => {
      this.server.emit('inspector:element', e);
    });

    this.inspectorService.on('inspector:status', (e: InspectorStatusEvent) => {
      this.server.emit('inspector:status', e);
    });

    this.logger.log('InspectorGateway initialised — namespace: /inspector');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
    // 늦은 구독자에게 현재 상태 전달
    client.emit('inspector:status', { state: this.inspectorService.getState() });
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }
}
