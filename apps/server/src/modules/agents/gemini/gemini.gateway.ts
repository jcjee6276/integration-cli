import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { GeminiAuthManager } from './gemini-auth.manager';
import { GeminiSessionManager } from './gemini-session.manager';
import { SendInputDto } from './dto/send-input.dto';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { ResultEvent, SessionExitEvent, TextDeltaEvent } from './interfaces/stream-event.interface';

/**
 * WebSocket 이벤트 프로토콜 (/agents/gemini)
 *
 * Client → Server
 *   session:create    { workingDirectory? }
 *   session:message   { sessionId, input }
 *   session:terminate { sessionId }
 *   auth:gca:start
 *   auth:login:cancel
 *
 * Server → Client
 *   session:created   { id, status, ... }
 *   session:text      { sessionId, text }
 *   session:result    { sessionId, isError }
 *   session:exit      { sessionId, exitCode }
 *   error             { message }
 *   auth:output       { text }
 *   auth:done         { success }
 */
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@WebSocketGateway({ namespace: '/agents/gemini', cors: { origin: '*' } })
export class GeminiGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(GeminiGateway.name);

  constructor(
    private readonly sessionManager: GeminiSessionManager,
    private readonly authManager: GeminiAuthManager,
  ) {}

  // ─── Gateway hooks ───────────────────────────────────────────────────

  afterInit(): void {
    this.sessionManager.on('text-delta', (event: TextDeltaEvent) => {
      this.server.to(event.sessionId).emit('session:text', event);
    });

    this.sessionManager.on('result', (event: ResultEvent) => {
      this.server.to(event.sessionId).emit('session:result', event);
    });

    this.sessionManager.on('exit', (event: SessionExitEvent) => {
      this.server.to(event.sessionId).emit('session:exit', event);
    });

    this.sessionManager.on('error', (event: { sessionId: string; message: string }) => {
      this.server.to(event.sessionId).emit('error', { message: event.message });
    });

    this.logger.log('GeminiGateway initialised — namespace: /agents/gemini');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.authManager.cancelLogin(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ─── Session handlers ────────────────────────────────────────────────

  @SubscribeMessage('session:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateSessionDto,
  ): void {
    try {
      const session = this.sessionManager.createSession(dto.workingDirectory);
      void client.join(session.id);
      client.emit('session:created', session);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @SubscribeMessage('session:message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string } & SendInputDto,
  ): void {
    try {
      void client.join(body.sessionId);
      this.sessionManager.sendMessage(body.sessionId, body.input);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @SubscribeMessage('session:terminate')
  handleTerminate(
    @ConnectedSocket() client: Socket,
    @MessageBody('sessionId') sessionId: string,
  ): void {
    try {
      this.sessionManager.terminateSession(sessionId);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  // ─── Auth handlers ───────────────────────────────────────────────────

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

  // ─── Private ─────────────────────────────────────────────────────────

  private emitError(client: Socket, err: unknown): void {
    const message = err instanceof Error ? err.message : 'Unknown error';
    this.logger.error(`[${client.id}] ${message}`);
    client.emit('error', { message });
    throw new WsException(message);
  }
}
