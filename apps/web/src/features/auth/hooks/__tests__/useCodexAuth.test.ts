import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../../api/auth.api";
import { extractDeviceCode, extractUrls, useCodexAuth } from "../useCodexAuth";

vi.mock("../../api/auth.api", () => ({
  configureCodexAuth: vi.fn(),
  getCodexAuthStatus: vi.fn(),
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

const mockGetStatus = vi.mocked(authApi.getCodexAuthStatus);
const mockConfigure = vi.mocked(authApi.configureCodexAuth);

beforeEach(() => {
  mockGetStatus.mockResolvedValue({ installed: true, loggedIn: false });
});

afterEach(() => {
  vi.clearAllMocks();
  socketMock.reset();
});

describe("Codex auth helpers", () => {
  it("extracts unique URLs and device code", () => {
    expect(extractUrls("go https://a.test/path then https://a.test/path")).toEqual(["https://a.test/path"]);
    expect(extractDeviceCode("Your code is ABCD-123456")).toBe("ABCD-123456");
    expect(extractDeviceCode("no code")).toBeNull();
  });
});

describe("useCodexAuth", () => {
  it("checks auth status on mount", async () => {
    const { result } = renderHook(() => useCodexAuth());
    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));
  });

  it("switches login method", async () => {
    const { result } = renderHook(() => useCodexAuth());
    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));

    act(() => { result.current.setLoginMethod("apikey"); });
    expect(result.current.loginMethod).toBe("apikey");
  });

  it("saves API key and can reset API key login state", async () => {
    const { result } = renderHook(() => useCodexAuth());

    await act(async () => { await result.current.saveApiKey("key"); });
    expect(mockConfigure).toHaveBeenCalledWith("key");
    expect(result.current.apiKeyLoginState).toBe("done");

    act(() => { result.current.resetApiKeyLogin(); });
    expect(result.current.apiKeyLoginState).toBe("idle");
  });

  it("stores config error when API key save fails", async () => {
    mockConfigure.mockRejectedValueOnce(new Error("bad"));
    const { result } = renderHook(() => useCodexAuth());

    await act(async () => { await result.current.saveApiKey("bad"); });

    expect(result.current.apiKeyLoginState).toBe("error");
    expect(result.current.configError).toMatch(/API 키 저장/);
  });

  it("runs device login, extracts URL and code, and handles done", async () => {
    const { result } = renderHook(() => useCodexAuth());
    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));

    act(() => { result.current.startDeviceLogin(); });
    act(() => { socketMock.handlers.connect?.(); });
    expect(socketMock.socket.emit).toHaveBeenCalledWith("auth:login:start");

    act(() => {
      socketMock.handlers["auth:output"]?.({ text: "Open https://auth.test and enter WXYZ-1234" });
      socketMock.handlers["auth:done"]?.({ success: true });
    });

    expect(result.current.loginUrls).toEqual(["https://auth.test"]);
    expect(result.current.deviceCode).toBe("WXYZ-1234");
    expect(result.current.loginState).toBe("done");
    expect(result.current.authState).toBe("authenticated");
  });

  it("cancels device login and handles disconnect during active login", async () => {
    const { result } = renderHook(() => useCodexAuth());
    await waitFor(() => expect(result.current.authState).toBe("unauthenticated"));

    act(() => { result.current.startDeviceLogin(); });
    act(() => { socketMock.handlers.disconnect?.(); });
    expect(result.current.loginState).toBe("error");

    act(() => {
      result.current.startDeviceLogin();
      result.current.cancelDeviceLogin();
    });
    expect(socketMock.socket.emit).toHaveBeenCalledWith("auth:login:cancel");
    expect(result.current.loginState).toBe("idle");
  });
});
