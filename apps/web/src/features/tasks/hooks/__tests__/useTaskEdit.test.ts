import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "../../api/tasks.api";
import * as tasksApi from "../../api/tasks.api";
import { useTaskEdit } from "../useTaskEdit";

vi.mock("../../api/tasks.api", () => ({
  updateTask: vi.fn(),
}));

const mockUpdateTask = vi.mocked(tasksApi.updateTask);

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Original",
    status: "pending",
    workingDir: "/repo",
    requirements: [
      { id: 2, content: "Second", status: "pending", orderIndex: 1 },
      { id: 1, content: "First", status: "pending", orderIndex: 0 },
    ],
    agents: [
      { id: 1, agentType: "claude", role: "backend", customRole: null, status: "pending" },
    ],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    ...overrides,
  };
}

beforeEach(() => {
  mockUpdateTask.mockResolvedValue(task({ title: "Updated" }));
});

afterEach(() => { vi.clearAllMocks(); });

describe("useTaskEdit", () => {
  it("hydrates form from task and sorts requirements by orderIndex", () => {
    const { result } = renderHook(() => useTaskEdit(task()));

    expect(result.current.form.title).toBe("Original");
    expect(result.current.form.workingDir).toBe("/repo");
    expect(result.current.form.requirements.map((r) => r.content)).toEqual(["First", "Second"]);
    expect(result.current.form.agents[0]).toEqual(
      expect.objectContaining({ agentType: "claude", role: "backend", customRole: "" }),
    );
  });

  it("syncs the form when task id changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTaskEdit(value),
      { initialProps: { value: task() } },
    );

    rerender({ value: task({ id: "task-2", title: "Next", workingDir: null, requirements: [], agents: [] }) });

    expect(result.current.form.title).toBe("Next");
    expect(result.current.form.workingDir).toBe("");
    expect(result.current.form.requirements).toEqual([]);
  });

  it("updates and removes requirement drafts", () => {
    const { result } = renderHook(() => useTaskEdit(task({ requirements: [] })));

    act(() => { result.current.addRequirement(); });
    const id = result.current.form.requirements[0].id;
    act(() => { result.current.updateRequirement(id, "  Trim me  "); });
    expect(result.current.form.requirements[0].content).toBe("  Trim me  ");

    act(() => { result.current.removeRequirement(id); });
    expect(result.current.form.requirements).toEqual([]);
  });

  it("updates and removes agent drafts", () => {
    const { result } = renderHook(() => useTaskEdit(task({ agents: [] })));

    act(() => { result.current.addAgent("codex", "other"); });
    const id = result.current.form.agents[0].id;
    act(() => { result.current.updateAgent(id, { customRole: "Reviewer" }); });
    expect(result.current.form.agents[0]).toEqual(
      expect.objectContaining({ agentType: "codex", role: "other", customRole: "Reviewer" }),
    );

    act(() => { result.current.removeAgent(id); });
    expect(result.current.form.agents).toEqual([]);
  });

  it("validates an empty title before submitting", async () => {
    const { result } = renderHook(() => useTaskEdit(task()));
    act(() => { result.current.setTitle("   "); });

    await act(async () => { await result.current.submit(); });

    expect(result.current.error).toBe("작업 제목을 입력하세요.");
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("submits trimmed payload and calls onSuccess", async () => {
    const updated = task({ title: "Updated" });
    mockUpdateTask.mockResolvedValueOnce(updated);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTaskEdit(task({ requirements: [], agents: [] }), onSuccess));

    act(() => {
      result.current.setTitle("  New title  ");
      result.current.setWorkingDir("  /new/repo  ");
      result.current.addRequirement();
      result.current.addAgent("gemini", "other");
    });
    const reqId = result.current.form.requirements[0].id;
    const agentId = result.current.form.agents[0].id;
    act(() => {
      result.current.updateRequirement(reqId, "  Build UI  ");
      result.current.updateAgent(agentId, { customRole: "  QA Lead  " });
    });

    await act(async () => { await result.current.submit(); });

    expect(mockUpdateTask).toHaveBeenCalledWith("task-1", {
      title: "New title",
      workingDir: "/new/repo",
      requirements: [{ content: "Build UI", orderIndex: 0 }],
      agents: [{ agentType: "gemini", role: "other", customRole: "QA Lead" }],
    });
    expect(onSuccess).toHaveBeenCalledWith(updated);
    expect(result.current.submitting).toBe(false);
  });

  it("stores update errors and resets submitting", async () => {
    mockUpdateTask.mockRejectedValueOnce(new Error("update failed"));
    const { result } = renderHook(() => useTaskEdit(task()));

    await act(async () => { await result.current.submit(); });

    expect(result.current.error).toBe("update failed");
    expect(result.current.submitting).toBe(false);
  });
});
