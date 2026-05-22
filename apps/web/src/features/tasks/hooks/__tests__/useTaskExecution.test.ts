import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTaskExecution } from "../useTaskExecution";

type Handler = (payload?: unknown) => void;

const socketMock = vi.hoisted(() => {
  const handlers: Record<string, Handler> = {};
  const socket = {
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
      return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    handlers,
    socket,
    io: vi.fn(() => socket),
    reset() {
      for (const key of Object.keys(handlers)) delete handlers[key];
      socket.on.mockClear();
      socket.emit.mockClear();
      socket.disconnect.mockClear();
      this.io.mockClear();
    },
  };
});

vi.mock("socket.io-client", () => ({
  io: socketMock.io,
}));

afterEach(() => {
  socketMock.reset();
});

describe("useTaskExecution", () => {
  it("does not connect without a task id", () => {
    renderHook(() => useTaskExecution(null));
    expect(socketMock.io).not.toHaveBeenCalled();
  });

  it("connects, subscribes, and requests buffered logs", () => {
    const { result } = renderHook(() => useTaskExecution("task-1"));

    expect(socketMock.io).toHaveBeenCalledWith(
      expect.stringContaining("/tasks"),
      { transports: ["websocket"] },
    );

    act(() => { socketMock.handlers.connect(); });

    expect(result.current.connected).toBe(true);
    expect(socketMock.socket.emit).toHaveBeenCalledWith("task:subscribe", { taskId: "task-1" });
    expect(socketMock.socket.emit).toHaveBeenCalledWith("task:get-logs", { taskId: "task-1" });
  });

  it("appends live output and tool events", () => {
    const { result } = renderHook(() => useTaskExecution("task-1"));

    act(() => {
      socketMock.handlers["agent:output"]?.({ taskId: "task-1", agentId: 1, text: "hello" });
      socketMock.handlers["agent:output"]?.({ taskId: "task-1", agentId: 1, text: " world" });
      socketMock.handlers["agent:tool"]?.({
        taskId: "task-1",
        agentId: 1,
        tool: "Bash",
        input: { command: "npm test" },
      });
    });

    expect(result.current.agentLogs[1].output).toContain("hello world");
    expect(result.current.agentLogs[1].output).toContain("Bash");
    expect(result.current.agentLogs[1].output).toContain("npm test");
  });

  it("loads buffered logs and keeps longer live output", () => {
    const { result } = renderHook(() => useTaskExecution("task-1"));

    act(() => {
      socketMock.handlers["agent:output"]?.({ taskId: "task-1", agentId: 1, text: "long live output" });
      socketMock.handlers["task:buffered-logs"]?.({
        taskId: "task-1",
        logs: [
          { agentId: 1, status: "running", output: "short" },
          { agentId: 2, status: "completed", output: "buffered", durationMs: 10, costUsd: 0.01 },
        ],
      });
    });

    expect(result.current.agentLogs[1].output).toBe("long live output");
    expect(result.current.agentLogs[2]).toEqual(
      expect.objectContaining({ agentId: 2, status: "completed", output: "buffered", durationMs: 10, costUsd: 0.01 }),
    );
  });

  it("marks agents completed or errored", () => {
    const { result } = renderHook(() => useTaskExecution("task-1"));

    act(() => {
      socketMock.handlers["agent:done"]?.({
        taskId: "task-1",
        agentId: 1,
        result: "ok",
        isError: false,
        durationMs: 1200,
        costUsd: 0.1234,
      });
      socketMock.handlers["agent:error"]?.({ taskId: "task-1", agentId: 2, message: "failed" });
    });

    expect(result.current.agentLogs[1]).toEqual(
      expect.objectContaining({ status: "completed", durationMs: 1200, costUsd: 0.1234 }),
    );
    expect(result.current.agentLogs[2]).toEqual(
      expect.objectContaining({ status: "error", errorMessage: "failed" }),
    );
  });

  it("forwards task status changes", () => {
    const onTaskStatusChange = vi.fn();
    renderHook(() => useTaskExecution("task-1", onTaskStatusChange));

    act(() => {
      socketMock.handlers["task:status"]?.({ taskId: "task-1", status: "completed" });
    });

    expect(onTaskStatusChange).toHaveBeenCalledWith("task-1", "completed");
  });

  it("unsubscribes and disconnects on cleanup", () => {
    const { unmount } = renderHook(() => useTaskExecution("task-1"));

    unmount();

    expect(socketMock.socket.emit).toHaveBeenCalledWith("task:unsubscribe", { taskId: "task-1" });
    expect(socketMock.socket.disconnect).toHaveBeenCalled();
  });
});
