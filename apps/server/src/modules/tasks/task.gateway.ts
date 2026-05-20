import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import {
  TaskExecutionService,
} from './task-execution.service';
import type {
  AgentDoneEvent,
  AgentErrorEvent,
  AgentOutputEvent,
  AgentToolEvent,
  TaskStatusEvent,
} from './task-execution.service';

/**
 * WebSocket 프로토콜 (/tasks 네임스페이스)
 *
 * Client → Server
 *   task:subscribe    { taskId }   해당 태스크 룸 구독
 *   task:unsubscribe  { taskId }   구독 해제
 *
 * Server → Client
 *   agent:output  { taskId, agentId, sessionId, text }
 *   agent:tool    { taskId, agentId, tool, input }
 *   agent:done    { taskId, agentId, result, isError, durationMs, costUsd }
 *   agent:error   { taskId, agentId, message }
 *   task:status   { taskId, status }
 */
@WebSocketGateway({ namespace: '/tasks', cors: { origin: '*' } })
export class TaskGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(TaskGateway.name);

  constructor(private readonly executionService: TaskExecutionService) {}

  afterInit(): void {
    this.executionService.on('agent:output', (e: AgentOutputEvent) => {
      this.server.to(`task:${e.taskId}`).emit('agent:output', e);
    });

    this.executionService.on('agent:tool', (e: AgentToolEvent) => {
      this.server.to(`task:${e.taskId}`).emit('agent:tool', e);
    });

    this.executionService.on('agent:done', (e: AgentDoneEvent) => {
      this.server.to(`task:${e.taskId}`).emit('agent:done', e);
    });

    this.executionService.on('agent:error', (e: AgentErrorEvent) => {
      this.server.to(`task:${e.taskId}`).emit('agent:error', e);
    });

    this.executionService.on('task:status', (e: TaskStatusEvent) => {
      this.server.to(`task:${e.taskId}`).emit('task:status', e);
    });

    this.logger.log('TaskGateway initialised — namespace: /tasks');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('task:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody('taskId') taskId: string,
  ): void {
    void client.join(`task:${taskId}`);
    this.logger.debug(`${client.id} subscribed to task:${taskId}`);
  }

  @SubscribeMessage('task:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody('taskId') taskId: string,
  ): void {
    void client.leave(`task:${taskId}`);
  }

  /** 구독 후 즉시 버퍼된 로그 요청 — 늦은 구독자가 이전 출력을 받는 용도 */
  @SubscribeMessage('task:get-logs')
  handleGetLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody('taskId') taskId: string,
  ): void {
    const logs = this.executionService.getBufferedLogs(taskId);
    client.emit('task:buffered-logs', { taskId, logs });
  }
}
