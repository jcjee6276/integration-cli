import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as tasksApi from "../../api/tasks.api";
import { useTaskNotification } from "../useTaskNotification";

const addToast = vi.fn();

vi.mock("@/lib/toast", () => ({
  useToast: () => ({ addToast }),
}));

vi.mock("../../api/tasks.api", () => ({
  fetchTasks: vi.fn(),
}));

const socketMock = vi.hoisted(() => {
  const handlers: Record<string, (payload?: unknown) => void> = {};
  const socket = {
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
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

const mockFetchTasks = vi.mocked(tasksApi.fetchTasks);

beforeEach(() => {
  mockFetchTasks.mockResolvedValue([
    {
      id: "task-1",
      title: "Initial",
      status: "running",
      workingDir: null,
      requirements: [],
      agents: [],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
  socketMock.reset();
});

describe("useTaskNotification", () => {
  it("loads initial task status and subscribes to global task events", async () => {
    renderHook(() => useTaskNotification());

    await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledTimes(1));
    act(() => { socketMock.handlers.connect?.(); });

    expect(socketMock.socket.emit).toHaveBeenCalledWith("task:watch-all");
  });

  it("shows success toast and marks hasNew on completed transition", async () => {
    const { result } = renderHook(() => useTaskNotification());
    await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledTimes(1));

    act(() => {
      socketMock.handlers["task:status"]?.({ taskId: "task-1", status: "completed" });
    });

    expect(addToast).toHaveBeenCalledWith({ type: "success", title: "작업 완료", message: "Initial" });
    expect(result.current.hasNew).toBe(true);

    act(() => { result.current.clearNew(); });
    expect(result.current.hasNew).toBe(false);
  });

  it("uses event title and emits error/info toasts", async () => {
    renderHook(() => useTaskNotification());
    await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledTimes(1));

    act(() => {
      socketMock.handlers["task:status"]?.({ taskId: "task-2", status: "error", title: "Broken" });
      socketMock.handlers["task:status"]?.({ taskId: "task-3", status: "stopped", title: "Stopped" });
    });

    expect(addToast).toHaveBeenCalledWith({ type: "error", title: "작업 오류", message: "Broken" });
    expect(addToast).toHaveBeenCalledWith({ type: "info", title: "작업 중지됨", message: "Stopped" });
  });

  it("does not notify repeatedly after a task is already finished", async () => {
    renderHook(() => useTaskNotification());
    await waitFor(() => expect(mockFetchTasks).toHaveBeenCalledTimes(1));

    act(() => {
      socketMock.handlers["task:status"]?.({ taskId: "task-1", status: "completed" });
      socketMock.handlers["task:status"]?.({ taskId: "task-1", status: "error" });
    });

    expect(addToast).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes and disconnects on cleanup", () => {
    const { unmount } = renderHook(() => useTaskNotification());

    unmount();

    expect(socketMock.socket.emit).toHaveBeenCalledWith("task:unwatch-all");
    expect(socketMock.socket.disconnect).toHaveBeenCalled();
  });
});
