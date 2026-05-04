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

import { ClaudePtyManager } from './claude-pty.manager';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { ResizeSessionDto } from './dto/resize-session.dto';
import type { SendInputDto } from './dto/send-input.dto';
import type { PtyExitEvent, PtyOutputEvent } from './interfaces/pty-event.interface';

/**
 * WebSocket 이벤트 프로토콜
 *
 * Client → Server
 *   session:create   { workingDirectory?, env? }   세션 생성
 *   session:subscribe { sessionId }                 출력 구독
 *   session:unsubscribe { sessionId }               구독 해제
 *   session:input    { sessionId, input }           텍스트 전송
 *   session:resize   { sessionId, cols, rows }      터미널 크기 조정
 *   session:terminate { sessionId }                 세션 종료
 *
 * Server → Client
 *   session:created  { sessionId, ... }             세션 생성 완료
 *   session:output   { sessionId, data, timestamp } PTY 출력
 *   session:exit     { sessionId, exitCode }        프로세스 종료
 *   error            { message }                    오류
 */
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@WebSocketGateway({ namespace: '/agents/claude', cors: { origin: '*' } })
export class ClaudeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ClaudeGateway.name);

  // socketId → subscribed sessionIds
  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly ptyManager: ClaudePtyManager) {}

  // ─── Gateway hooks ──────────────────────────────────────────────────

  afterInit(): void {
    this.ptyManager.on('output', (event: PtyOutputEvent) => {
      this.server.to(event.sessionId).emit('session:output', event);
    });

    this.ptyManager.on('exit', (event: PtyExitEvent) => {
      this.server.to(event.sessionId).emit('session:exit', event);
    });

    this.logger.log('ClaudeGateway initialised — namespace: /agents/claude');
  }

  handleConnection(client: Socket): void {
    this.subscriptions.set(client.id, new Set());
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.subscriptions.delete(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ─── Message handlers ───────────────────────────────────────────────

  @SubscribeMessage('session:create')
  handleCreate(@ConnectedSocket() client: Socket, @MessageBody() dto: CreateSessionDto): void {
    try {
      const session = this.ptyManager.createSession(dto.workingDirectory, dto.env);
      client.emit('session:created', session);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @SubscribeMessage('session:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody('sessionId') sessionId: string,
  ): void {
    try {
      this.ptyManager.getSessionInfo(sessionId);
      void client.join(sessionId);
      this.subscriptions.get(client.id)?.add(sessionId);

      // replay buffered output so the client is immediately up to date
      const buffer = this.ptyManager.getOutputBuffer(sessionId);
      if (buffer.length > 0) {
        client.emit('session:output', {
          sessionId,
          data: buffer.join(''),
          timestamp: new Date(),
        });
      }
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @SubscribeMessage('session:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody('sessionId') sessionId: string,
  ): void {
    void client.leave(sessionId);
    this.subscriptions.get(client.id)?.delete(sessionId);
  }

  @SubscribeMessage('session:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string } & SendInputDto,
  ): void {
    try {
      this.ptyManager.sendInput(body.sessionId, body.input);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @SubscribeMessage('session:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string } & ResizeSessionDto,
  ): void {
    try {
      this.ptyManager.resize(body.sessionId, body.cols, body.rows);
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
      this.ptyManager.terminateSession(sessionId);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  // ─── Private ────────────────────────────────────────────────────────

  private emitError(client: Socket, err: unknown): void {
    const message = err instanceof Error ? err.message : 'Unknown error';
    this.logger.error(`[${client.id}] ${message}`);
    client.emit('error', { message });
    throw new WsException(message);
  }
}
