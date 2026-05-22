import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../../api/auth.api";
import { useGeminiAuth } from "../useGeminiAuth";

vi.mock("../../api/auth.api", () => ({
  configureGeminiAuth: vi.fn(),
  getGeminiAuthStatus: vi.fn(),
}));

const socketMock = vi.hoisted(() => {
  const handlers: Record<string, (payload?: unknown) => void> = {};
  const socket = {
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers[event] = handler;
      return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    handlers,
    socket,
    io: vi.fn(() => socket),
    reset() {
      for (const key of Object.keys(handlers)) delete handlers[key];
      socket.on.mockClear();
      socket.emit.mockClear();
      socket.disconnect.mockClear();
      this.io.mockClear();
    },
  };
});

vi.mock("socket.io-client", () => ({ io: socketMock.io }));

const mockGetStatus = vi.mocked(authApi.getGeminiAuthStatus);
const mockConfigure = vi.mocked(authApi.configureGeminiAuth);

beforeEach(() => {
  mockGetStatus.mockResolvedValue({ installed: true, loggedIn: false, authMethod: "none" });
});

afterEach(() => {
  vi.clearAllMocks();
  socketMock.reset();
});

describe("useGeminiAuth", () => {
  it("checks auth status on mount", async () => {
    const { result } = renderHook(() => useGeminiAuth());

    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));
  });

  it("marks not-installed and handles status failures", async () => {
    mockGetStatus.mockResolvedValueOnce({ installed: false, loggedIn: false, authMethod: "none" });
    const { result, rerender } = renderHook(() => useGeminiAuth());
    await waitFor(() => expect(result.current.authState).toBe("not-installed"));

    mockGetStatus.mockRejectedValueOnce(new Error("down"));
    await act(async () => { await result.current.checkAuth(); });
    rerender();
    expect(result.current.authState).toBe("unauthenticated");
  });

  it("saves API key and authenticates", async () => {
    const { result } = renderHook(() => useGeminiAuth());
    await act(async () => { await result.current.saveApiKey("key"); });

    expect(mockConfigure).toHaveBeenCalledWith("api-key", "key");
    expect(result.current.loginState).toBe("done");
    expect(result.current.authState).toBe("authenticated");
  });

  it("stores config error when API key save fails", async () => {
    mockConfigure.mockRejectedValueOnce(new Error("bad"));
    const { result } = renderHook(() => useGeminiAuth());

    await act(async () => { await result.current.saveApiKey("bad"); });

    expect(result.current.loginState).toBe("error");
    expect(result.current.configError).toMatch(/API 키 저장/);
  });

  it("runs GCA login over socket, extracts URLs, and handles success", async () => {
    const { result } = renderHook(() => useGeminiAuth());
    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));

    act(() => { result.current.startGcaLogin(); });
    act(() => { socketMock.handlers.connect?.(); });
    expect(socketMock.socket.emit).toHaveBeenCalledWith("auth:gca:start");

    act(() => {
      socketMock.handlers["auth:output"]?.({ text: "Open https://example.com/auth\n" });
      socketMock.handlers["auth:done"]?.({ success: true });
    });

    expect(result.current.loginUrls).toEqual(["https://example.com/auth"]);
    expect(result.current.loginState).toBe("done");
    expect(result.current.authState).toBe("authenticated");
  });

  it("cancels an active GCA login and resets output", async () => {
    const { result } = renderHook(() => useGeminiAuth());
    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));

    act(() => {
      result.current.startGcaLogin();
      socketMock.handlers["auth:output"]?.({ text: "https://example.com" });
      result.current.cancelLogin();
    });

    expect(socketMock.socket.emit).toHaveBeenCalledWith("auth:login:cancel");
    expect(socketMock.socket.disconnect).toHaveBeenCalled();
    expect(result.current.loginState).toBe("idle");
    expect(result.current.loginOutput).toBe("");
  });
});
