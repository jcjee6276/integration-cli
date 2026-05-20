import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { GeminiAuthManager } from './gemini-auth.manager';

@WebSocketGateway({ namespace: '/agents/gemini', cors: { origin: '*' } })
export class GeminiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(GeminiGateway.name);

  constructor(private readonly authManager: GeminiAuthManager) {}

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.authManager.cancelLogin(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** GCA 인증: gcloud auth application-default login 을 실행하고 출력을 스트리밍 */
  @SubscribeMessage('auth:gca:start')
  handleGcaLoginStart(@ConnectedSocket() client: Socket): void {
    this.authManager.startGcaLogin(
      client.id,
      (text) => client.emit('auth:output', { text }),
      (success) => client.emit('auth:done', { success }),
    );
  }

  @SubscribeMessage('auth:login:cancel')
  handleAuthLoginCancel(@ConnectedSocket() client: Socket): void {
    this.authManager.cancelLogin(client.id);
  }
}
