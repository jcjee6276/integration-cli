import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveTask,
  createTask,
  deleteTask,
  executeTask,
  fetchTaskConversations,
  fetchTask,
  fetchTaskRuns,
  fetchTasks,
  rerunTask,
  rerunTaskAgent,
  stopTask,
  updateTask,
} from "../tasks.api";
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

describe("fetchTask", () => {
  it("returns one task", async () => {
    mockFetch.mockReturnValueOnce(ok(mockTask));

    const result = await fetchTask("task-1");

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/tasks/task-1"));
    expect(result).toEqual(mockTask);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(404));
    await expect(fetchTask("missing")).rejects.toThrow("HTTP 404");
  });
});

describe("updateTask", () => {
  it("sends PATCH with JSON body", async () => {
    mockFetch.mockReturnValueOnce(ok(mockTask));

    await updateTask("task-1", { title: "수정" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1"),
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "수정" }),
      }),
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(400));
    await expect(updateTask("task-1", { title: "" })).rejects.toThrow("HTTP 400");
  });
});

describe("archiveTask", () => {
  it("posts to archive endpoint", async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true } as Response));

    await archiveTask("task-1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/archive"),
      { method: "POST" },
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(409));
    await expect(archiveTask("task-1")).rejects.toThrow("HTTP 409");
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

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(500));
    await expect(deleteTask("task-123")).rejects.toThrow("HTTP 500");
  });
});

describe("execution controls", () => {
  it("executeTask posts and returns the updated task", async () => {
    mockFetch.mockReturnValueOnce(ok({ ...mockTask, status: "running" }));

    const result = await executeTask("task-1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/execute"),
      { method: "POST" },
    );
    expect(result.status).toBe("running");
  });

  it("stopTask posts and returns the updated task", async () => {
    mockFetch.mockReturnValueOnce(ok({ ...mockTask, status: "stopped" }));

    const result = await stopTask("task-1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/stop"),
      { method: "POST" },
    );
    expect(result.status).toBe("stopped");
  });

  it("rerunTask posts supplement note as JSON", async () => {
    mockFetch.mockReturnValueOnce(ok({ ...mockTask, status: "running" }));

    await rerunTask("task-1", "추가 지시");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/rerun"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplementNote: "추가 지시" }),
      },
    );
  });

  it("rerunTaskAgent posts supplement note as JSON", async () => {
    mockFetch.mockReturnValueOnce(ok({ ...mockTask, status: "running" }));

    await rerunTaskAgent("task-1", 7, "agent note");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/agents/7/rerun"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplementNote: "agent note" }),
      },
    );
  });

  it("throws when execution endpoints fail", async () => {
    mockFetch.mockReturnValueOnce(err(500));
    await expect(executeTask("task-1")).rejects.toThrow("HTTP 500");

    mockFetch.mockReturnValueOnce(err(409));
    await expect(stopTask("task-1")).rejects.toThrow("HTTP 409");

    mockFetch.mockReturnValueOnce(err(422));
    await expect(rerunTask("task-1")).rejects.toThrow("HTTP 422");
  });
});

describe("fetchTaskRuns", () => {
  it("returns run history", async () => {
    const runs = [{ id: 1, version: 1, supplementNote: null, status: "completed", startedAt: "2024-01-01", completedAt: null, agentRuns: [] }];
    mockFetch.mockReturnValueOnce(ok(runs));

    const result = await fetchTaskRuns("task-1");

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/tasks/task-1/runs"));
    expect(result).toEqual(runs);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(500));
    await expect(fetchTaskRuns("task-1")).rejects.toThrow("HTTP 500");
  });
});

describe("fetchTaskConversations", () => {
  it("returns task conversations", async () => {
    const conversations = [{ id: "c1", sessionId: "task-1", promptId: "p1", agentId: 1, runId: 2, content: "log", agentModel: "claude", type: "agent_message", createdAt: "2024-01-01" }];
    mockFetch.mockReturnValueOnce(ok(conversations));

    const result = await fetchTaskConversations("task-1");

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/conversations/session/task-1"));
    expect(result).toEqual(conversations);
  });
});
