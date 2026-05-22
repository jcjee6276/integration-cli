import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentChangelog } from "../../api/changelog.api";
import * as changelogApi from "../../api/changelog.api";
import { useTaskChangelog } from "../useTaskChangelog";

vi.mock("../../api/changelog.api", () => ({
  fetchTaskChangelog: vi.fn(),
}));

const mockFetchTaskChangelog = vi.mocked(changelogApi.fetchTaskChangelog);

const changelog: AgentChangelog = {
  agentId: 1,
  files: [
    { id: 1, filePath: "src/App.tsx", changeType: "modified", additions: 3, deletions: 1, patch: "@@" },
  ],
};

afterEach(() => { vi.clearAllMocks(); });

describe("useTaskChangelog", () => {
  it("clears changelogs and skips fetch without a task id", () => {
    const { result } = renderHook(() => useTaskChangelog(null));

    expect(result.current.changelogs).toEqual([]);
    expect(mockFetchTaskChangelog).not.toHaveBeenCalled();
  });

  it("loads changelogs with an abort signal", async () => {
    mockFetchTaskChangelog.mockResolvedValueOnce([changelog]);
    const { result } = renderHook(() => useTaskChangelog("task-1"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchTaskChangelog).toHaveBeenCalledWith("task-1", expect.any(AbortSignal));
    expect(result.current.changelogs).toEqual([changelog]);
  });

  it("stores errors from the API", async () => {
    mockFetchTaskChangelog.mockRejectedValueOnce(new Error("diff failed"));
    const { result } = renderHook(() => useTaskChangelog("task-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("diff failed");
  });
});
