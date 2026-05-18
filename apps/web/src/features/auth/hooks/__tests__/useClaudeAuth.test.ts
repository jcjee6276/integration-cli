import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { extractUrls, useClaudeAuth } from "../useClaudeAuth";

// ─── socket.io-client mock ────────────────────────────────────────────────────

const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// ─── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.clearAllMocks();
  // Default: not logged in
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ loggedIn: false, authMethod: "none", apiProvider: "firstParty" }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── extractUrls ─────────────────────────────────────────────────────────────

describe("extractUrls", () => {
  it("extracts a single URL", () => {
    expect(extractUrls("visit https://claude.ai/auth")).toEqual(["https://claude.ai/auth"]);
  });

  it("extracts multiple URLs and deduplicates", () => {
    const text = "go to https://a.com and https://a.com or https://b.com";
    expect(extractUrls(text)).toEqual(["https://a.com", "https://b.com"]);
  });

  it("returns empty array for text without URLs", () => {
    expect(extractUrls("no link here")).toEqual([]);
  });

  it("handles http URLs", () => {
    expect(extractUrls("http://localhost:3000")).toEqual(["http://localhost:3000"]);
  });
});

// ─── useClaudeAuth ────────────────────────────────────────────────────────────

describe("useClaudeAuth", () => {
  it("starts with authState=checking then resolves to unauthenticated", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    expect(result.current.authState).toBe("checking");

    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));
  });

  it("resolves to authenticated when loggedIn=true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty" }),
    });

    const { result } = renderHook(() => useClaudeAuth());

    await waitFor(() => expect(result.current.authState).toBe("authenticated"));
  });

  it("falls back to unauthenticated when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useClaudeAuth());

    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));
  });

  it("starts loginState as idle", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));
    expect(result.current.loginState).toBe("idle");
  });

  it("startLogin transitions loginState to pending and connects socket", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));

    act(() => { result.current.startLogin(); });

    expect(result.current.loginState).toBe("pending");
    expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("auth:output", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("auth:done", expect.any(Function));
  });

  it("ignores duplicate startLogin when already pending", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));

    const { io } = await import("socket.io-client");
    const mockIo = vi.mocked(io);
    mockIo.mockClear();

    act(() => { result.current.startLogin(); });
    act(() => { result.current.startLogin(); }); // second call should be ignored

    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it("cancelLogin resets loginState to idle", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));

    act(() => { result.current.startLogin(); });
    act(() => { result.current.cancelLogin(); });

    expect(result.current.loginState).toBe("idle");
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it("auth:done with success=true sets authenticated and done", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));

    act(() => { result.current.startLogin(); });

    // Simulate auth:done event
    const doneHandler = mockSocket.on.mock.calls.find(([event]) => event === "auth:done")?.[1];
    act(() => { doneHandler?.({ success: true }); });

    expect(result.current.loginState).toBe("done");
    expect(result.current.authState).toBe("authenticated");
  });

  it("auth:done with success=false sets error state", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));

    act(() => { result.current.startLogin(); });
    const doneHandler = mockSocket.on.mock.calls.find(([event]) => event === "auth:done")?.[1];
    act(() => { doneHandler?.({ success: false }); });

    expect(result.current.loginState).toBe("error");
  });

  it("auth:output accumulates text and extracts URLs", async () => {
    const { result } = renderHook(() => useClaudeAuth());
    await waitFor(() => expect(result.current.authState).not.toBe("checking"));

    act(() => { result.current.startLogin(); });
    const outputHandler = mockSocket.on.mock.calls.find(([event]) => event === "auth:output")?.[1];

    act(() => { outputHandler?.({ text: "Open https://claude.ai/auth to login\n" }); });

    expect(result.current.loginOutput).toContain("https://claude.ai/auth");
    expect(result.current.loginUrls).toContain("https://claude.ai/auth");
  });
});
