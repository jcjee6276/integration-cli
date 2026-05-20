import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTask, deleteTask, fetchTasks } from "../tasks.api";
import type { CreateTaskPayload } from "../tasks.api";

const mockFetch = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.unstubAllGlobals(); });

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}
function err(status: number) {
  return Promise.resolve({ ok: false, status } as Response);
}

const mockTask = {
  id: "task-1",
  title: "로그인 구현",
  status: "pending",
  workingDir: null,
  requirements: [],
  agents: [],
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

describe("createTask", () => {
  const payload: CreateTaskPayload = {
    title: "로그인 구현",
    requirements: [{ content: "UI 디자인", orderIndex: 0 }],
    agents: [{ agentType: "claude", role: "frontend" }],
  };

  it("sends POST with correct body", async () => {
    mockFetch.mockReturnValueOnce(ok(mockTask));

    await createTask(payload);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  });

  it("returns created task", async () => {
    mockFetch.mockReturnValueOnce(ok(mockTask));
    const result = await createTask(payload);
    expect(result.id).toBe("task-1");
    expect(result.title).toBe("로그인 구현");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(422));
    await expect(createTask(payload)).rejects.toThrow("HTTP 422");
  });

  it("includes workingDir when provided", async () => {
    mockFetch.mockReturnValueOnce(ok(mockTask));
    const payloadWithDir = { ...payload, workingDir: "/project" };
    await createTask(payloadWithDir);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify(payloadWithDir) }),
    );
  });
});

describe("fetchTasks", () => {
  it("returns task list", async () => {
    mockFetch.mockReturnValueOnce(ok([mockTask]));

    const result = await fetchTasks();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task-1");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/tasks"));
  });

  it("returns empty array when no tasks", async () => {
    mockFetch.mockReturnValueOnce(ok([]));
    const result = await fetchTasks();
    expect(result).toHaveLength(0);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(500));
    await expect(fetchTasks()).rejects.toThrow("HTTP 500");
  });
});

describe("deleteTask", () => {
  it("sends DELETE to correct URL", async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true } as Response));

    await deleteTask("task-123");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-123"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
