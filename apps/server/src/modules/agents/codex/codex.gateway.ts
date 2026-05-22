import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { CodexAuthManager } from './codex-auth.manager';
import { CodexSessionManager } from './codex-session.manager';

@WebSocketGateway({ namespace: '/agents/codex', cors: { origin: '*' } })
export class CodexGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(CodexGateway.name);

  constructor(
    private readonly authManager: CodexAuthManager,
    private readonly sessionManager: CodexSessionManager,
  ) {}

  afterInit(): void {
    this.sessionManager.on('session:text', (ev) => this.server.to(ev.sessionId).emit('session:text', ev));
    this.sessionManager.on('session:result', (ev) => this.server.to(ev.sessionId).emit('session:result', ev));
    this.sessionManager.on('session:exit', (ev) => this.server.to(ev.sessionId).emit('session:exit', ev));
    this.sessionManager.on('error', (ev) => this.server.to(ev.sessionId).emit('error', { message: ev.message }));
    this.logger.log('CodexGateway initialised — namespace: /agents/codex');
  }

  handleDisconnect(client: Socket): void {
    this.authManager.cancelLogin(client.id);
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

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

  // ─── Session ──────────────────────────────────────────────────────────────

  @SubscribeMessage('session:message')
  handleSessionMessage(
    @ConnectedSocket() client: Socket,
    data: { sessionId: string; input: string },
  ): void {
    try {
      void client.join(data.sessionId);
      this.sessionManager.sendMessage(data.sessionId, data.input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('session:join')
  handleSessionJoin(@ConnectedSocket() client: Socket, data: { sessionId: string }): void {
    void client.join(data.sessionId);
  }

  @SubscribeMessage('session:terminate')
  handleSessionTerminate(@ConnectedSocket() client: Socket, data: { sessionId: string }): void {
    try {
      this.sessionManager.terminateSession(data.sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('error', { message });
    }
  }
}
