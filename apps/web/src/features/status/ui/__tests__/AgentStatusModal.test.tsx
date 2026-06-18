import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as authApi from "@/features/auth/api/auth.api";

import { AgentStatusModal } from "../AgentStatusModal";

vi.mock("@/features/auth/api/auth.api", () => ({
  getClaudeStatus: vi.fn(),
  getGeminiAuthStatus: vi.fn(),
}));

const mockClaude = vi.mocked(authApi.getClaudeStatus);
const mockGemini = vi.mocked(authApi.getGeminiAuthStatus);

afterEach(() => {
  vi.clearAllMocks();
});

describe("AgentStatusModal", () => {
  it("does not render when closed", () => {
    render(<AgentStatusModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("에이전트 상태")).not.toBeInTheDocument();
  });

  it("loads and renders Claude/Gemini status plus coming soon cards", async () => {
    mockClaude.mockResolvedValue({
      version: "1.0.0",
      platform: "darwin",
      activeSessions: 2,
      usage: { available: false, label: "usage unavailable" },
      auth: {
        loggedIn: true,
        authMethod: "oauth",
        apiProvider: "anthropic",
        email: "user@example.com",
        orgName: "Org",
        subscriptionType: "pro",
      },
    });
    mockGemini.mockResolvedValue({
      installed: true,
      loggedIn: true,
      authMethod: "api-key",
      email: "gemini@example.com",
    });

    render(<AgentStatusModal open={true} onClose={vi.fn()} />);

    expect(await screen.findByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Gemini CLI")).toBeInTheDocument();
    expect(screen.getByText("gemini@example.com")).toBeInTheDocument();
    expect(screen.getByText("API Key")).toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getAllByText("OpenCode")).toHaveLength(2);
    expect(screen.getAllByText("준비 중")).toHaveLength(2);
  });

  it("refreshes and renders offline/missing states when requests fail", async () => {
    const user = userEvent.setup();
    mockClaude.mockRejectedValue(new Error("offline"));
    mockGemini.mockResolvedValue({ installed: false, loggedIn: false, authMethod: "none" });

    render(<AgentStatusModal open={true} onClose={vi.fn()} />);

    expect(await screen.findByText("오프라인")).toBeInTheDocument();
    expect(screen.getByText("미설치")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(mockClaude).toHaveBeenCalledTimes(2));
  });
});
