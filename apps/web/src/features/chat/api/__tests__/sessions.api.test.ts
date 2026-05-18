import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSession,
  deleteSession,
  fetchConversations,
  fetchDBSessions,
  saveConversation,
} from "../sessions.api";

const mockFetch = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.unstubAllGlobals(); });

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}
function err(status: number) {
  return Promise.resolve({ ok: false, status } as Response);
}

describe("fetchDBSessions", () => {
  it("returns session list", async () => {
    const sessions = [{ sessionId: "abc", title: "My Session", createdAt: "2024-01-01" }];
    mockFetch.mockReturnValueOnce(ok(sessions));

    const result = await fetchDBSessions();

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("abc");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/sessions"));
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(500));
    await expect(fetchDBSessions()).rejects.toThrow("HTTP 500");
  });
});

describe("createSession", () => {
  const mockSession = {
    id: "sess-1",
    title: "새 세션",
    createdAt: "2024-01-01",
  };

  it("sends POST without workingDirectory when omitted", async () => {
    mockFetch.mockReturnValueOnce(ok(mockSession));

    await createSession();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/agents/claude/sessions"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({}) }),
    );
  });

  it("sends POST with workingDirectory when provided", async () => {
    mockFetch.mockReturnValueOnce(ok(mockSession));

    await createSession("/home/user/project");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ workingDirectory: "/home/user/project" }),
      }),
    );
  });

  it("returns session info", async () => {
    mockFetch.mockReturnValueOnce(ok(mockSession));
    const result = await createSession();
    expect(result.id).toBe("sess-1");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(400));
    await expect(createSession()).rejects.toThrow("HTTP 400");
  });
});

describe("deleteSession", () => {
  it("sends DELETE to correct URL", async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true } as Response));

    await deleteSession("sess-123");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/agents/claude/sessions/sess-123"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("fetchConversations", () => {
  it("returns conversation list for session", async () => {
    const convos = [
      { id: "c1", sessionId: "s1", promptId: "p1", content: "hello", agentModel: "claude", type: "user_message", createdAt: "2024-01-01" },
    ];
    mockFetch.mockReturnValueOnce(ok(convos));

    const result = await fetchConversations("s1");

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/conversations/session/s1"),
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(404));
    await expect(fetchConversations("bad-id")).rejects.toThrow("HTTP 404");
  });
});

describe("saveConversation", () => {
  it("fires POST without awaiting", () => {
    mockFetch.mockReturnValueOnce(ok({}));

    saveConversation("s1", "p1", "hello", "user_message");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/conversations"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sessionId: "s1",
          promptId: "p1",
          content: "hello",
          agentModel: "claude",
          type: "user_message",
        }),
      }),
    );
  });
});
