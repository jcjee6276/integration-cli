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

import { TaskExecutionService } from './task-execution.service';
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
 *   task:subscribe    { taskId }  특정 태스크 룸 구독 (에이전트 출력 수신)
 *   task:unsubscribe  { taskId }  특정 태스크 룸 구독 해제
 *   task:get-logs     { taskId }  버퍼된 로그 요청 (늦은 구독자)
 *   task:watch-all              전역 알림 룸 구독 (모든 task:status 수신)
 *   task:unwatch-all            전역 알림 룸 구독 해제
 *
 * Server → Client
 *   agent:output        { taskId, agentId, text }
 *   agent:tool          { taskId, agentId, tool, input }
 *   agent:done          { taskId, agentId, result, isError, durationMs, costUsd }
 *   agent:error         { taskId, agentId, message }
 *   task:status         { taskId, status, title? }  — 특정 룸 + 전역 알림 룸
 *   task:buffered-logs  { taskId, logs }
 */

const NOTIFICATIONS_ROOM = 'task:notifications';

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
      // 1. 특정 태스크 룸 (에이전트 출력 패널용)
      this.server.to(`task:${e.taskId}`).emit('task:status', e);
      // 2. 전역 알림 룸 (useTaskNotification 구독자 전체)
      this.server.to(NOTIFICATIONS_ROOM).emit('task:status', e);
    });

    this.logger.log('TaskGateway initialised — namespace: /tasks');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ─── 특정 태스크 구독 ─────────────────────────────────────────────────────

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

  /** 늦은 구독자용 — 버퍼 우선, 없으면 DB에서 복원 */
  @SubscribeMessage('task:get-logs')
  handleGetLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody('taskId') taskId: string,
  ): void {
    const buffered = this.executionService.getBufferedLogs(taskId);

    if (buffered.length > 0) {
      client.emit('task:buffered-logs', { taskId, logs: buffered });
      return;
    }

    // 서버 재시작 후 버퍼 소실 — DB에서 복원
    void this.executionService.getLogsFromDb(taskId).then((logs) => {
      client.emit('task:buffered-logs', { taskId, logs });
    });
  }

  // ─── 전역 알림 룸 ─────────────────────────────────────────────────────────

  /** 모든 task:status 이벤트를 받는 전역 알림 룸 가입 */
  @SubscribeMessage('task:watch-all')
  handleWatchAll(@ConnectedSocket() client: Socket): void {
    void client.join(NOTIFICATIONS_ROOM);
    this.logger.debug(`${client.id} joined notifications room`);
  }

  /** 전역 알림 룸 탈퇴 */
  @SubscribeMessage('task:unwatch-all')
  handleUnwatchAll(@ConnectedSocket() client: Socket): void {
    void client.leave(NOTIFICATIONS_ROOM);
  }
}
