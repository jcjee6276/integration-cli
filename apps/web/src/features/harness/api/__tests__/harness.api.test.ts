import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteHarness, fetchAllHarnesses, fetchHarness, saveHarness } from "../harness.api";

const mockFetch = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", mockFetch); });
afterEach(() => { vi.unstubAllGlobals(); });

function ok(body?: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}

function err(status: number) {
  return Promise.resolve({ ok: false, status } as Response);
}

describe("harness api", () => {
  it("fetches all harnesses", async () => {
    const body = [{ role: "frontend", ext: "md", content: "rules" }];
    mockFetch.mockReturnValueOnce(ok(body));

    await expect(fetchAllHarnesses()).resolves.toEqual(body);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/harness"));
  });

  it("fetches one harness by role", async () => {
    const body = { role: "backend", ext: "tsx", content: "code" };
    mockFetch.mockReturnValueOnce(ok(body));

    await expect(fetchHarness("backend")).resolves.toEqual(body);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/harness/backend"));
  });

  it("saves harness content with PUT JSON", async () => {
    const body = { role: "doc", ext: "md", content: "updated" };
    mockFetch.mockReturnValueOnce(ok(body));

    await expect(saveHarness("doc", "updated", "md")).resolves.toEqual(body);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/harness/doc"),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated", ext: "md" }),
      },
    );
  });

  it("deletes harness by role", async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true } as Response));

    await deleteHarness("operation");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/harness/operation"),
      { method: "DELETE" },
    );
  });

  it("throws for non-ok fetch/save responses", async () => {
    mockFetch.mockReturnValueOnce(err(404));
    await expect(fetchHarness("other")).rejects.toThrow("HTTP 404");

    mockFetch.mockReturnValueOnce(err(500));
    await expect(saveHarness("other", "x", "md")).rejects.toThrow("HTTP 500");
  });
});
