import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionsApi from "../../api/sessions.api";
import { useGeminiSessions } from "../useGeminiSessions";

vi.mock("../../api/sessions.api", () => ({
  createGeminiSession: vi.fn(),
  deleteGeminiSession: vi.fn(),
  fetchConversations: vi.fn(),
  fetchDBSessions: vi.fn(),
  saveGeminiConversation: vi.fn(),
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
const mockCreateSession = vi.mocked(sessionsApi.createGeminiSession);
const mockDeleteSession = vi.mocked(sessionsApi.deleteGeminiSession);
const mockSave = vi.mocked(sessionsApi.saveGeminiConversation);

beforeEach(() => {
  mockFetchDB.mockResolvedValue([{ sessionId: "db-1", title: "DB", createdAt: "2024-01-01" }]);
  mockFetchConversations.mockResolvedValue([
    { id: "c1", sessionId: "db-1", promptId: "p1", type: "user_message", content: "hi", createdAt: "2024-01-01", agentModel: "gemini" },
    { id: "c2", sessionId: "db-1", promptId: "p2", type: "agent_message", content: "other", createdAt: "2024-01-01", agentModel: "codex" },
  ]);
  mockCreateSession.mockResolvedValue({ id: "new-1", title: "Gemini", createdAt: "2024-01-02", workingDirectory: "/tmp/project" });
});

afterEach(() => {
  vi.clearAllMocks();
  socketMock.reset();
});

describe("useGeminiSessions", () => {
  it("connects and loads DB sessions", async () => {
    const { result } = renderHook(() => useGeminiSessions());

    expect(result.current.connectionStatus).toBe("connecting");
    act(() => { socketMock.handlers.connect?.(); });

    await waitFor(() => expect(result.current.connectionStatus).toBe("connected"));
    await waitFor(() => expect(result.current.sessions[0].info.id).toBe("db-1"));
  });

  it("creates, selects, sends, streams, and finishes a session", async () => {
    const { result } = renderHook(() => useGeminiSessions());

    let id: string | null = null;
    await act(async () => { id = await result.current.createSession("/tmp/project"); });
    expect(id).toBe("new-1");
    expect(result.current.selectedSession?.info.title).toBe("project");

    act(() => { result.current.sendMessage("new-1", "hello"); });
    expect(socketMock.socket.emit).toHaveBeenCalledWith("session:message", { sessionId: "new-1", input: "hello" });
    expect(result.current.selectedSession?.messages[0].content).toBe("hello");

    act(() => {
      socketMock.handlers["session:text"]?.({ sessionId: "new-1", text: "answer" });
      socketMock.handlers["session:result"]?.({ sessionId: "new-1", isError: false });
    });

    expect(mockSave).toHaveBeenCalled();
    expect(result.current.selectedSession?.messages.at(-1)?.content).toBe("answer");
    expect(result.current.selectedSession?.isWaiting).toBe(false);
  });

  it("loads conversations when selecting a DB session and terminates it", async () => {
    const { result } = renderHook(() => useGeminiSessions());
    act(() => { socketMock.handlers.connect?.(); });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    act(() => { result.current.selectSession("db-1"); });
    await waitFor(() => expect(mockFetchConversations).toHaveBeenCalledWith("db-1"));
    await waitFor(() => expect(result.current.selectedSession?.messages).toHaveLength(1));

    await act(async () => { await result.current.terminateSession("db-1"); });
    expect(mockDeleteSession).toHaveBeenCalledWith("db-1");
    expect(result.current.sessions).toEqual([]);
  });

  it("keeps the session visible when terminate fails", async () => {
    mockDeleteSession.mockRejectedValueOnce(new Error("delete failed"));
    const { result } = renderHook(() => useGeminiSessions());
    act(() => { socketMock.handlers.connect?.(); });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    await act(async () => { await result.current.terminateSession("db-1"); });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.error).toBe("delete failed");
  });

  it("sets errors from socket and create failures", async () => {
    mockCreateSession.mockRejectedValueOnce(new Error("create failed"));
    const { result } = renderHook(() => useGeminiSessions());

    await act(async () => { await result.current.createSession(); });
    expect(result.current.error).toBe("create failed");

    act(() => { socketMock.handlers.error?.({ message: "socket failed" }); });
    expect(result.current.error).toBe("socket failed");
  });
});
