import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthStatus, getClaudeStatus } from "../auth.api";

const mockFetch = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.unstubAllGlobals(); });

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}
function err(status: number) {
  return Promise.resolve({ ok: false, status } as Response);
}

describe("getAuthStatus", () => {
  it("returns auth data on success", async () => {
    const data = { loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty" };
    mockFetch.mockReturnValueOnce(ok(data));

    const result = await getAuthStatus();

    expect(result.loggedIn).toBe(true);
    expect(result.authMethod).toBe("claude.ai");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/agents/claude/auth/status"),
    );
  });

  it("returns unauthenticated data when not logged in", async () => {
    const data = { loggedIn: false, authMethod: "none", apiProvider: "firstParty" };
    mockFetch.mockReturnValueOnce(ok(data));
    const result = await getAuthStatus();
    expect(result.loggedIn).toBe(false);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(401));
    await expect(getAuthStatus()).rejects.toThrow("HTTP 401");
  });

  it("includes optional fields when present", async () => {
    const data = {
      loggedIn: true,
      authMethod: "claude.ai",
      apiProvider: "firstParty",
      email: "user@example.com",
      orgName: "Acme",
      subscriptionType: "pro",
    };
    mockFetch.mockReturnValueOnce(ok(data));
    const result = await getAuthStatus();
    expect(result.email).toBe("user@example.com");
    expect(result.subscriptionType).toBe("pro");
  });
});

describe("getClaudeStatus", () => {
  it("returns full status on success", async () => {
    const data = {
      version: "2.1.0 (Claude Code)",
      auth: { loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty" },
      activeSessions: 3,
      platform: "darwin arm64",
    };
    mockFetch.mockReturnValueOnce(ok(data));

    const result = await getClaudeStatus();

    expect(result.version).toBe("2.1.0 (Claude Code)");
    expect(result.activeSessions).toBe(3);
    expect(result.platform).toBe("darwin arm64");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/agents/claude/status"),
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockReturnValueOnce(err(500));
    await expect(getClaudeStatus()).rejects.toThrow("HTTP 500");
  });
});
