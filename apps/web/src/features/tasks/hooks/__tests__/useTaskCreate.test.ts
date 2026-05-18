import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as tasksApi from "../../api/tasks.api";
import { useTaskCreate } from "../useTaskCreate";

vi.mock("../../api/tasks.api", () => ({
  createTask: vi.fn(),
}));

const mockCreateTask = vi.mocked(tasksApi.createTask);

const stubTask = {
  id: "t1",
  title: "test",
  status: "pending",
  workingDir: null,
  requirements: [],
  agents: [],
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

beforeEach(() => { mockCreateTask.mockResolvedValue(stubTask); });
afterEach(() => { vi.clearAllMocks(); });

describe("useTaskCreate — initial state", () => {
  it("starts with empty form", () => {
    const { result } = renderHook(() => useTaskCreate());
    expect(result.current.form.title).toBe("");
    expect(result.current.form.requirements).toHaveLength(0);
    expect(result.current.form.agents).toHaveLength(0);
    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useTaskCreate — title & workingDir", () => {
  it("setTitle updates form.title", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.setTitle("My Task"); });
    expect(result.current.form.title).toBe("My Task");
  });

  it("setWorkingDir updates form.workingDir", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.setWorkingDir("/home/user"); });
    expect(result.current.form.workingDir).toBe("/home/user");
  });
});

describe("useTaskCreate — requirements", () => {
  it("addRequirement appends an empty item", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addRequirement(); });
    expect(result.current.form.requirements).toHaveLength(1);
    expect(result.current.form.requirements[0].content).toBe("");
  });

  it("updateRequirement changes the content", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addRequirement(); });
    const id = result.current.form.requirements[0].id;
    act(() => { result.current.updateRequirement(id, "UI 디자인"); });
    expect(result.current.form.requirements[0].content).toBe("UI 디자인");
  });

  it("removeRequirement removes the item by id", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addRequirement(); result.current.addRequirement(); });
    const id = result.current.form.requirements[0].id;
    act(() => { result.current.removeRequirement(id); });
    expect(result.current.form.requirements).toHaveLength(1);
  });

  it("updateRequirement does nothing for unknown id", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addRequirement(); });
    act(() => { result.current.updateRequirement("nonexistent", "ignored"); });
    expect(result.current.form.requirements[0].content).toBe("");
  });
});

describe("useTaskCreate — agents", () => {
  it("addAgent appends with default role frontend", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addAgent(); });
    expect(result.current.form.agents).toHaveLength(1);
    expect(result.current.form.agents[0].role).toBe("frontend");
  });

  it("addAgent respects explicit role", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addAgent("backend"); });
    expect(result.current.form.agents[0].role).toBe("backend");
  });

  it("updateAgent changes the role", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addAgent(); });
    const id = result.current.form.agents[0].id;
    act(() => { result.current.updateAgent(id, { role: "doc" }); });
    expect(result.current.form.agents[0].role).toBe("doc");
  });

  it("updateAgent changes customRole", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addAgent("other"); });
    const id = result.current.form.agents[0].id;
    act(() => { result.current.updateAgent(id, { customRole: "DevOps" }); });
    expect(result.current.form.agents[0].customRole).toBe("DevOps");
  });

  it("removeAgent removes by id", () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.addAgent(); result.current.addAgent("backend"); });
    const id = result.current.form.agents[0].id;
    act(() => { result.current.removeAgent(id); });
    expect(result.current.form.agents).toHaveLength(1);
    expect(result.current.form.agents[0].role).toBe("backend");
  });
});

describe("useTaskCreate — submit", () => {
  it("sets error when title is empty", async () => {
    const { result } = renderHook(() => useTaskCreate());
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe("작업 제목을 입력하세요.");
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("calls createTask with trimmed title", async () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.setTitle("  My Task  "); });
    await act(async () => { await result.current.submit(); });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My Task" }),
    );
  });

  it("filters out empty requirements", async () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => {
      result.current.setTitle("Task");
      result.current.addRequirement();
      result.current.addRequirement();
    });
    const id = result.current.form.requirements[0].id;
    act(() => { result.current.updateRequirement(id, "Filled"); });
    await act(async () => { await result.current.submit(); });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ requirements: [{ content: "Filled", orderIndex: 0 }] }),
    );
  });

  it("omits customRole for non-other agents", async () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.setTitle("Task"); result.current.addAgent("backend"); });
    await act(async () => { await result.current.submit(); });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: [{ role: "backend", customRole: undefined }],
      }),
    );
  });

  it("includes customRole for other agents", async () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => {
      result.current.setTitle("Task");
      result.current.addAgent("other");
    });
    const id = result.current.form.agents[0].id;
    act(() => { result.current.updateAgent(id, { customRole: "DevOps" }); });
    await act(async () => { await result.current.submit(); });
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: [{ role: "other", customRole: "DevOps" }],
      }),
    );
  });

  it("calls onSuccess and resets form after success", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTaskCreate(onSuccess));
    act(() => { result.current.setTitle("Task"); });
    await act(async () => { await result.current.submit(); });
    expect(onSuccess).toHaveBeenCalledWith(stubTask);
    expect(result.current.form.title).toBe("");
  });

  it("sets error when createTask throws", async () => {
    mockCreateTask.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useTaskCreate());
    act(() => { result.current.setTitle("Task"); });
    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe("Network error");
  });
});

describe("useTaskCreate — reset", () => {
  it("clears form and error", async () => {
    const { result } = renderHook(() => useTaskCreate());
    act(() => {
      result.current.setTitle("X");
      result.current.addRequirement();
      result.current.addAgent();
    });
    await act(async () => { await result.current.submit(); }); // trigger error (no, title set)
    act(() => { result.current.reset(); });
    expect(result.current.form.title).toBe("");
    expect(result.current.form.requirements).toHaveLength(0);
    expect(result.current.form.agents).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
