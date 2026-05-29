import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as harnessApi from "../../api/harness.api";
import { useHarness } from "../useHarness";

vi.mock("../../api/harness.api", () => ({
  fetchHarness: vi.fn(),
  saveHarness: vi.fn(),
}));

const mockFetchHarness = vi.mocked(harnessApi.fetchHarness);
const mockSaveHarness = vi.mocked(harnessApi.saveHarness);

afterEach(() => { vi.clearAllMocks(); });

beforeEach(() => {
  mockFetchHarness.mockResolvedValue({ role: "backend", ext: "md", content: "" });
});

describe("useHarness", () => {
  it("does not load when role is null", () => {
    const { result } = renderHook(() => useHarness(null));

    expect(result.current.harness).toBeNull();
    expect(mockFetchHarness).not.toHaveBeenCalled();
  });

  it("loads harness for a role and resets dirty state", async () => {
    mockFetchHarness.mockResolvedValueOnce({ role: "frontend", ext: "tsx", content: "hello" });
    const { result } = renderHook(() => useHarness("frontend"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.content).toBe("hello");
    expect(result.current.ext).toBe("tsx");
    expect(result.current.dirty).toBe(false);
  });

  it("marks dirty when content or extension changes", () => {
    const { result } = renderHook(() => useHarness(null));

    act(() => {
      result.current.setContent("new");
      result.current.setExt("tsx");
    });

    expect(result.current.content).toBe("new");
    expect(result.current.ext).toBe("tsx");
    expect(result.current.dirty).toBe(true);
  });

  it("saves current content and clears dirty", async () => {
    mockSaveHarness.mockResolvedValueOnce({ role: "backend", ext: "md", content: "saved" });
    const { result } = renderHook(() => useHarness("backend"));

    act(() => { result.current.setContent("saved"); });
    await act(async () => { await result.current.save(); });

    expect(mockSaveHarness).toHaveBeenCalledWith("backend", "saved", "md");
    expect(result.current.harness).toEqual({ role: "backend", ext: "md", content: "saved" });
    expect(result.current.saving).toBe(false);
    expect(result.current.dirty).toBe(false);
  });
});
