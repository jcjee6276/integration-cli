"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SERVER_URL } from "@/lib/constants";
import type { AgentStatus, TaskStatus } from "../api/tasks.api";

const TASKS_WS_NAMESPACE = "/tasks";

// ─── 서버 이벤트 타입 ─────────────────────────────────────────────────────────

interface AgentOutputEvent  { taskId: string; agentId: number; text: string }
interface AgentToolEvent    { taskId: string; agentId: number; tool: string; input: Record<string, unknown> }
interface AgentDoneEvent    { taskId: string; agentId: number; result: string; isError: boolean; durationMs: number; costUsd: number }
interface AgentErrorEvent   { taskId: string; agentId: number; message: string }
interface TaskStatusEvent   { taskId: string; status: TaskStatus }

interface BufferedAgentLog {
  agentId: number;
  status: string;
  output: string;
  durationMs?: number;
  costUsd?: number;
  errorMessage?: string;
}

// ─── 클라이언트 상태 ──────────────────────────────────────────────────────────

export interface AgentLog {
  agentId: number;
  status: AgentStatus;
  output: string;
  durationMs?: number;
  costUsd?: number;
  errorMessage?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTaskExecution(
  taskId: string | null,
  onTaskStatusChange?: (taskId: string, status: TaskStatus) => void,
) {
  const [agentLogs, setAgentLogs] = useState<Record<number, AgentLog>>({});
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const upsertAgent = useCallback((agentId: number, patch: Partial<AgentLog>) => {
    setAgentLogs((prev) => {
      const base: AgentLog = prev[agentId] ?? { agentId, status: "running", output: "" };
      return { ...prev, [agentId]: { ...base, ...patch } };
    });
  }, []);

  const appendOutput = useCallback((agentId: number, text: string) => {
    setAgentLogs((prev) => {
      const base: AgentLog = prev[agentId] ?? { agentId, status: "running", output: "" };
      return { ...prev, [agentId]: { ...base, output: base.output + text } };
    });
  }, []);

  useEffect(() => {
    if (!taskId) return;

    setAgentLogs({});
    const socket = io(`${SERVER_URL}${TASKS_WS_NAMESPACE}`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // 1. 룸 구독
      socket.emit("task:subscribe", { taskId });
      // 2. 이미 실행 중이거나 완료된 경우 버퍼 요청 (타이밍 경쟁 조건 해결)
      socket.emit("task:get-logs", { taskId });
    });

    socket.on("disconnect", () => setConnected(false));

    // 늦은 구독 — 서버가 저장해 둔 버퍼를 한 번에 리플레이
    socket.on("task:buffered-logs", ({ logs }: { taskId: string; logs: BufferedAgentLog[] }) => {
      setAgentLogs((prev) => {
        const next = { ...prev };
        for (const log of logs) {
          const existing = next[log.agentId];
          // 이미 라이브 이벤트로 받은 내용이 있으면 버퍼가 더 짧을 수 있으므로 긴 것 유지
          if (!existing || existing.output.length < log.output.length) {
            next[log.agentId] = {
              agentId: log.agentId,
              status: (log.status as AgentStatus) ?? "running",
              output: log.output,
              durationMs: log.durationMs,
              costUsd: log.costUsd,
              errorMessage: log.errorMessage,
            };
          }
        }
        return next;
      });
    });

    // 라이브 이벤트
    socket.on("agent:output", ({ agentId, text }: AgentOutputEvent) => {
      appendOutput(agentId, text);
    });

    socket.on("agent:tool", ({ agentId, tool, input }: AgentToolEvent) => {
      const line = `\n⚙ ${tool}(${JSON.stringify(input).slice(0, 120)})\n`;
      appendOutput(agentId, line);
    });

    socket.on("agent:done", ({ agentId, isError, durationMs, costUsd }: AgentDoneEvent) => {
      upsertAgent(agentId, {
        status: isError ? "error" : "completed",
        durationMs,
        costUsd,
      });
    });

    socket.on("agent:error", ({ agentId, message }: AgentErrorEvent) => {
      upsertAgent(agentId, { status: "error", errorMessage: message });
    });

    socket.on("task:status", ({ taskId: tid, status }: TaskStatusEvent) => {
      onTaskStatusChange?.(tid, status);
    });

    return () => {
      socket.emit("task:unsubscribe", { taskId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [taskId, upsertAgent, appendOutput, onTaskStatusChange]);

  return { agentLogs, connected };
}
