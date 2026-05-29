import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskRun } from "../../api/tasks.api";
import * as tasksApi from "../../api/tasks.api";
import { useTaskRuns } from "../useTaskRuns";

vi.mock("../../api/tasks.api", () => ({
  fetchTaskRuns: vi.fn(),
}));

const mockFetchTaskRuns = vi.mocked(tasksApi.fetchTaskRuns);

const run: TaskRun = {
  id: 1,
  version: 1,
  supplementNote: null,
  status: "completed",
  startedAt: "2024-01-01",
  completedAt: "2024-01-01",
  agentRuns: [],
};

afterEach(() => { vi.clearAllMocks(); });

describe("useTaskRuns", () => {
  it("clears runs and skips fetch without a task id", () => {
    const { result } = renderHook(() => useTaskRuns(null));

    expect(result.current.runs).toEqual([]);
    expect(mockFetchTaskRuns).not.toHaveBeenCalled();
  });

  it("loads runs for a task id", async () => {
    mockFetchTaskRuns.mockResolvedValueOnce([run]);
    const { result } = renderHook(() => useTaskRuns("task-1"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchTaskRuns).toHaveBeenCalledWith("task-1");
    expect(result.current.runs).toEqual([run]);
  });

  it("stores errors from the API", async () => {
    mockFetchTaskRuns.mockRejectedValueOnce(new Error("history failed"));
    const { result } = renderHook(() => useTaskRuns("task-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("history failed");
  });
});
