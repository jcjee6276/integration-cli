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

import { ClaudeAuthManager } from './claude-auth.manager';
import { ClaudePtyManager } from './claude-pty.manager';
import type { ClaudeCreateSessionDto as CreateSessionDto } from './dto/create-session.dto';
import type { SendInputDto } from './dto/send-input.dto';
import type {
  ResultEvent,
  SessionExitEvent,
  TextDeltaEvent,
  ToolUseEvent,
} from './interfaces/stream-event.interface';

/**
 * WebSocket 이벤트 프로토콜
 *
 * Client → Server
 *   session:create    { workingDirectory? }           세션 생성
 *   session:message   { sessionId, input }            메시지 전송 → claude 실행
 *   session:terminate { sessionId }                   세션 종료
 *
 * Server → Client
 *   session:created   { id, status, ... }             세션 생성 완료
 *   session:text      { sessionId, text }             텍스트 스트리밍 (delta)
 *   session:tool      { sessionId, tool, input }      도구 사용 알림
 *   session:result    { sessionId, result, ... }      응답 완료 + 메타데이터
 *   session:exit      { sessionId, exitCode }         프로세스 종료
 *   error             { message }                     오류
 */
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@WebSocketGateway({ namespace: '/agents/claude', cors: { origin: '*' } })
export class ClaudeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ClaudeGateway.name);
  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(
    private readonly ptyManager: ClaudePtyManager,
    private readonly authManager: ClaudeAuthManager,
  ) {}

  // ─── Gateway hooks ───────────────────────────────────────────────────

  afterInit(): void {
    this.ptyManager.on('text-delta', (event: TextDeltaEvent) => {
      this.server.to(event.sessionId).emit('session:text', event);
    });

    this.ptyManager.on('tool-use', (event: ToolUseEvent) => {
      this.server.to(event.sessionId).emit('session:tool', event);
    });

    this.ptyManager.on('result', (event: ResultEvent) => {
      this.server.to(event.sessionId).emit('session:result', event);
    });

    this.ptyManager.on('exit', (event: SessionExitEvent) => {
      this.server.to(event.sessionId).emit('session:exit', event);
    });

    this.ptyManager.on('error', (event: { sessionId: string; message: string }) => {
      this.server.to(event.sessionId).emit('error', { message: event.message });
    });

    this.logger.log('ClaudeGateway initialised — namespace: /agents/claude');
  }

  handleConnection(client: Socket): void {
    this.subscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket): void {
    this.authManager.cancelLogin(client.id);
    this.subscriptions.delete(client.id);
  }

  // ─── Message handlers ────────────────────────────────────────────────

  @SubscribeMessage('session:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateSessionDto,
  ): void {
    try {
      const session = this.ptyManager.createSession(dto.workingDirectory, dto.model, dto.reasoning);
      void client.join(session.id);
      this.subscriptions.get(client.id)?.add(session.id);
      client.emit('session:created', session);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @SubscribeMessage('session:message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string; model?: string; reasoning?: string } & SendInputDto,
  ): void {
    try {
      void client.join(body.sessionId);
      this.subscriptions.get(client.id)?.add(body.sessionId);
      this.ptyManager.sendMessageWithSettings(body.sessionId, body.input, body.model, body.reasoning);
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

  // ─── Auth ────────────────────────────────────────────────────────────

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

  // ─── Private ─────────────────────────────────────────────────────────

  private emitError(client: Socket, err: unknown): void {
    const message = err instanceof Error ? err.message : 'Unknown error';
    this.logger.error(`[${client.id}] ${message}`);
    client.emit('error', { message });
    throw new WsException(message);
  }
}
