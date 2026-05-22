import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTaskChangelog, mergeAgentAll, mergeAgentFile } from "../changelog.api";

const mockFetch = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.unstubAllGlobals(); });

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}

function err(status: number) {
  return Promise.resolve({ ok: false, status } as Response);
}

describe("changelog api", () => {
  it("fetchTaskChangelog passes the task id and abort signal", async () => {
    const controller = new AbortController();
    const body = [{ agentId: 1, files: [] }];
    mockFetch.mockReturnValueOnce(ok(body));

    const result = await fetchTaskChangelog("task-1", controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/changelog"),
      { signal: controller.signal },
    );
    expect(result).toEqual(body);
  });

  it("fetchTaskChangelog throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(404));
    await expect(fetchTaskChangelog("missing")).rejects.toThrow("HTTP 404");
  });

  it("mergeAgentAll posts to the agent merge endpoint", async () => {
    const body = { success: true, message: "merged" };
    mockFetch.mockReturnValueOnce(ok(body));

    const result = await mergeAgentAll("task-1", 7);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/agents/7/merge"),
      { method: "POST" },
    );
    expect(result).toEqual(body);
  });

  it("mergeAgentFile posts a JSON filePath body", async () => {
    const body = { success: true, message: "merged file" };
    mockFetch.mockReturnValueOnce(ok(body));

    const result = await mergeAgentFile("task-1", 7, "src/App.tsx");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-1/agents/7/merge-file"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: "src/App.tsx" }),
      },
    );
    expect(result).toEqual(body);
  });

  it("merge endpoints throw on HTTP errors", async () => {
    mockFetch.mockReturnValueOnce(err(409));
    await expect(mergeAgentAll("task-1", 1)).rejects.toThrow("HTTP 409");

    mockFetch.mockReturnValueOnce(err(500));
    await expect(mergeAgentFile("task-1", 1, "a.ts")).rejects.toThrow("HTTP 500");
  });
});
