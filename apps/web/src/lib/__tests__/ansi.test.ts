import { describe, expect, it } from "vitest";

import { cleanCliOutput, detectPermissionPrompt, stripAnsi } from "../ansi";

describe("stripAnsi", () => {
  it("removes CSI sequences", () => {
    expect(stripAnsi("\x1B[32mHello\x1B[0m")).toBe("Hello");
  });

  it("removes bold/color codes", () => {
    expect(stripAnsi("\x1B[1;34mtext\x1B[0m")).toBe("text");
  });

  it("normalises CRLF to LF", () => {
    expect(stripAnsi("line1\r\nline2")).toBe("line1\nline2");
  });

  it("normalises bare CR to LF", () => {
    expect(stripAnsi("line1\rline2")).toBe("line1\nline2");
  });

  it("passes through plain text unchanged", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });
});

describe("cleanCliOutput", () => {
  it("strips ANSI from output", () => {
    expect(cleanCliOutput("\x1B[32mok\x1B[0m")).toBe("ok");
  });

  it("removes separator lines (─ characters)", () => {
    const raw = "result\n──────────────────────────\nother";
    const cleaned = cleanCliOutput(raw);
    expect(cleaned).not.toContain("──");
    expect(cleaned).toContain("result");
  });

  it("removes spinner-only lines", () => {
    const raw = "✽ thinking\nactual output";
    const cleaned = cleanCliOutput(raw);
    expect(cleaned).not.toContain("✽");
    expect(cleaned).toContain("actual output");
  });

  it("removes timing inline noise", () => {
    // "thinking" triggers NOISE_LINE_PATTERNS so the whole line is dropped
    const raw = "response text (3s · ↓ 109 tokens · thinking)";
    expect(cleanCliOutput(raw)).toBe("");
  });

  it("removes inline timing without noise keyword", () => {
    // Only the timing bracket is present — no token counter or 'thinking'
    const raw = "final response (5s · done)";
    const cleaned = cleanCliOutput(raw);
    expect(cleaned).not.toMatch(/\(\d+s/);
    expect(cleaned).toContain("final response");
  });

  it("collapses 3+ consecutive blank lines into 2", () => {
    const raw = "a\n\n\n\n\nb";
    expect(cleanCliOutput(raw)).toBe("a\n\nb");
  });

  it("removes ⎿ output markers", () => {
    expect(cleanCliOutput("⎿ output here")).toBe("output here");
  });
});

describe("detectPermissionPrompt", () => {
  it("detects a bash permission prompt", () => {
    const text = "Bash command\ngit status\nDo you want to proceed? ❯ 1. Yes";
    const result = detectPermissionPrompt(text);
    expect(result).not.toBeNull();
    expect(result?.tool).toBe("Bash");
    expect(result?.command).toBe("git status");
  });

  it("captures warning line when present", () => {
    const text = "Bash command\nrm -rf /tmp\nContains shell expansion\nDo you want to proceed? ❯ 1. Yes";
    const result = detectPermissionPrompt(text);
    expect(result?.warning).toBe("Contains shell expansion");
  });

  it("returns null for non-permission text", () => {
    expect(detectPermissionPrompt("Just a normal response")).toBeNull();
  });
});
