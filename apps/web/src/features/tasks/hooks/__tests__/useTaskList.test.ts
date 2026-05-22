import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "../../api/tasks.api";
import * as tasksApi from "../../api/tasks.api";
import { useTaskList } from "../useTaskList";

vi.mock("../../api/tasks.api", () => ({
  archiveTask: vi.fn(),
  deleteTask: vi.fn(),
  executeTask: vi.fn(),
  fetchTasks: vi.fn(),
  rerunTask: vi.fn(),
  stopTask: vi.fn(),
}));

const mockFetchTasks = vi.mocked(tasksApi.fetchTasks);
const mockExecuteTask = vi.mocked(tasksApi.executeTask);
const mockStopTask = vi.mocked(tasksApi.stopTask);
const mockRerunTask = vi.mocked(tasksApi.rerunTask);
const mockArchiveTask = vi.mocked(tasksApi.archiveTask);
const mockDeleteTask = vi.mocked(tasksApi.deleteTask);

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Task",
    status: "pending",
    workingDir: null,
    requirements: [],
    agents: [],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchTasks.mockResolvedValue([task()]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useTaskList", () => {
  it("does not load tasks while closed", () => {
    renderHook(() => useTaskList(false));
    expect(mockFetchTasks).not.toHaveBeenCalled();
  });

  it("loads tasks when opened and clears loading", async () => {
    const tasks = [task({ id: "task-1" }), task({ id: "task-2", title: "Second" })];
    mockFetchTasks.mockResolvedValueOnce(tasks);

    const { result } = renderHook(() => useTaskList(true));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual(tasks);
  });

  it("stores fetch errors and clears loading", async () => {
    mockFetchTasks.mockRejectedValueOnce(new Error("load failed"));

    const { result } = renderHook(() => useTaskList(true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("load failed");
  });

  it("updates a task after execute succeeds", async () => {
    const initial = task({ id: "task-1", status: "pending" });
    const updated = task({ id: "task-1", status: "running" });
    mockFetchTasks.mockResolvedValueOnce([initial]);
    mockExecuteTask.mockResolvedValueOnce(updated);
    const { result } = renderHook(() => useTaskList(true));
    await waitFor(() => expect(result.current.tasks).toEqual([initial]));

    await act(async () => { await result.current.execute("task-1"); });

    expect(mockExecuteTask).toHaveBeenCalledWith("task-1");
    expect(result.current.tasks[0].status).toBe("running");
    expect(result.current.actioningId).toBeNull();
  });

  it("sets an action error when stop fails", async () => {
    mockStopTask.mockRejectedValueOnce(new Error("cannot stop"));
    const { result } = renderHook(() => useTaskList(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.stop("task-1"); });

    expect(result.current.error).toBe("cannot stop");
    expect(result.current.actioningId).toBeNull();
  });

  it("passes supplement note to rerun and updates the task", async () => {
    const updated = task({ id: "task-1", status: "running" });
    mockRerunTask.mockResolvedValueOnce(updated);
    const { result } = renderHook(() => useTaskList(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.rerun("task-1", "extra context"); });

    expect(mockRerunTask).toHaveBeenCalledWith("task-1", "extra context");
    expect(result.current.tasks[0]).toEqual(updated);
  });

  it("removes tasks after archive and delete", async () => {
    mockFetchTasks.mockResolvedValueOnce([task({ id: "task-1" }), task({ id: "task-2" })]);
    const { result } = renderHook(() => useTaskList(true));
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    await act(async () => { await result.current.archive("task-1"); });
    expect(mockArchiveTask).toHaveBeenCalledWith("task-1");
    expect(result.current.tasks.map((t) => t.id)).toEqual(["task-2"]);

    await act(async () => { await result.current.remove("task-2"); });
    expect(mockDeleteTask).toHaveBeenCalledWith("task-2");
    expect(result.current.tasks).toEqual([]);
  });

  it("applies edit completion and task status events locally", async () => {
    const { result } = renderHook(() => useTaskList(true));
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => { result.current.setEditingTask(result.current.tasks[0]); });
    act(() => { result.current.onEditDone(task({ id: "task-1", title: "Edited" })); });
    expect(result.current.editingTask).toBeNull();
    expect(result.current.tasks[0].title).toBe("Edited");

    act(() => { result.current.updateTaskStatus("task-1", "completed"); });
    expect(result.current.tasks[0].status).toBe("completed");
  });

  it("polls while a running task exists and stops polling after unmount", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    mockFetchTasks.mockResolvedValue([task({ status: "running" })]);
    const { unmount } = renderHook(() => useTaskList(true));

    await waitFor(() => {
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
