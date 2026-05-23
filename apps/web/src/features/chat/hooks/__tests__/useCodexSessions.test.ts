import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionsApi from "../../api/sessions.api";
import { useCodexSessions } from "../useCodexSessions";

vi.mock("../../api/sessions.api", () => ({
  createCodexSession: vi.fn(),
  deleteCodexSession: vi.fn(),
  fetchConversations: vi.fn(),
  fetchDBSessions: vi.fn(),
  saveCodexConversation: vi.fn(),
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

const mockFetchDB = vi.mocked(sessionsApi.fetchDBSessions);
const mockFetchConversations = vi.mocked(sessionsApi.fetchConversations);
const mockCreateSession = vi.mocked(sessionsApi.createCodexSession);
const mockDeleteSession = vi.mocked(sessionsApi.deleteCodexSession);
const mockSave = vi.mocked(sessionsApi.saveCodexConversation);

beforeEach(() => {
  mockFetchDB.mockResolvedValue([{ sessionId: "db-1", title: "DB", createdAt: "2024-01-01" }]);
  mockFetchConversations.mockResolvedValue([
    { id: "c1", sessionId: "db-1", promptId: "p1", type: "agent_message", content: "codex", createdAt: "2024-01-01", agentModel: "codex" },
    { id: "c2", sessionId: "db-1", promptId: "p2", type: "agent_message", content: "gemini", createdAt: "2024-01-01", agentModel: "gemini" },
  ]);
  mockCreateSession.mockResolvedValue({ id: "old-1", title: "Codex", createdAt: "2024-01-02", workingDirectory: "/tmp/codex" });
});

afterEach(() => {
  vi.clearAllMocks();
  socketMock.reset();
});

describe("useCodexSessions", () => {
  it("connects and loads DB sessions", async () => {
    const { result } = renderHook(() => useCodexSessions());
    act(() => { socketMock.handlers.connect?.(); });

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    await waitFor(() => expect(result.current.sessions[0].agentId).toBe("codex"));
  });

  it("creates, sends, saves on result, and supports session replacement", async () => {
    const { result } = renderHook(() => useCodexSessions());

    await act(async () => { await result.current.createSession("/tmp/codex"); });
    expect(result.current.selectedSessionId).toBe("old-1");

    act(() => { result.current.sendMessage("old-1", "hello"); });
    expect(socketMock.socket.emit).toHaveBeenCalledWith("session:message", { sessionId: "old-1", input: "hello" });
    expect(mockSave).not.toHaveBeenCalled();

    act(() => {
      socketMock.handlers["session:text"]?.({ sessionId: "old-1", text: "answer" });
      socketMock.handlers["session:replaced"]?.({ oldSessionId: "old-1", newSessionId: "new-1" });
      socketMock.handlers["session:result"]?.({ sessionId: "new-1", isError: false });
    });

    expect(result.current.selectedSessionId).toBe("new-1");
    expect(mockSave).toHaveBeenCalledWith("new-1", expect.any(String), "hello", "user_message");
    expect(mockSave).toHaveBeenCalledWith("new-1", expect.any(String), "answer", "agent_message");
  });

  it("loads codex conversations and terminates selected session", async () => {
    const { result } = renderHook(() => useCodexSessions());
    act(() => { socketMock.handlers.connect?.(); });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    act(() => { result.current.selectSession("db-1"); });
    await waitFor(() => expect(mockFetchConversations).toHaveBeenCalledWith("db-1"));
    await waitFor(() => expect(result.current.selectedSession?.messages).toHaveLength(1));

    await act(async () => { await result.current.terminateSession("db-1"); });
    expect(mockDeleteSession).toHaveBeenCalledWith("db-1");
    expect(result.current.selectedSessionId).toBeNull();
  });

  it("keeps the session visible when terminate fails", async () => {
    mockDeleteSession.mockRejectedValueOnce(new Error("delete failed"));
    const { result } = renderHook(() => useCodexSessions());
    act(() => { socketMock.handlers.connect?.(); });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    await act(async () => { await result.current.terminateSession("db-1"); });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.error).toBe("delete failed");
  });

  it("handles exit, disconnect, and socket errors", async () => {
    const { result } = renderHook(() => useCodexSessions());
    await act(async () => { await result.current.createSession(); });
    act(() => {
      socketMock.handlers["session:text"]?.({ sessionId: "old-1", text: "partial" });
      socketMock.handlers["session:exit"]?.({ sessionId: "old-1" });
      socketMock.handlers.disconnect?.();
      socketMock.handlers.error?.({ message: "socket failed" });
    });

    expect(result.current.selectedSession?.streaming).toBe("");
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.error).toBe("socket failed");
  });
});
