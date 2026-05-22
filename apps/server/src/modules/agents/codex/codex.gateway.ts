import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { CodexAuthManager } from './codex-auth.manager';

@WebSocketGateway({ namespace: '/agents/codex', cors: { origin: '*' } })
export class CodexGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(CodexGateway.name);

  constructor(private readonly authManager: CodexAuthManager) {}

  handleDisconnect(client: Socket): void {
    this.authManager.cancelLogin(client.id);
  }

  @SubscribeMessage('auth:login:start')
  handleAuthLoginStart(@ConnectedSocket() client: Socket): void {
    this.authManager.startLogin(
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
