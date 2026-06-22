import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAuthStatus,
  getCodexAuthStatus,
  getGeminiAuthStatus,
} from "@/features/auth/api/auth.api";

import { AgentSelectModal } from "../AgentSelectModal";

vi.mock("@/features/auth/api/auth.api", () => ({
  getAuthStatus: vi.fn(async () => ({
    loggedIn: false,
    authMethod: "none",
    apiProvider: "none",
  })),
  getGeminiAuthStatus: vi.fn(async () => ({
    loggedIn: false,
    authMethod: "none",
    installed: false,
  })),
  getCodexAuthStatus: vi.fn(async () => ({
    installed: false,
    loggedIn: false,
  })),
}));

const disconnectedAgents = {
  claude: "disconnected",
  gemini: "connected",
  codex: "connecting",
  opencode: "disconnected",
} as const;

describe("AgentSelectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not refresh agent status when explicit statuses are provided", () => {
    render(
      <AgentSelectModal
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        connectionStatusByAgent={disconnectedAgents}
      />,
    );

    expect(getAuthStatus).not.toHaveBeenCalled();
    expect(getGeminiAuthStatus).not.toHaveBeenCalled();
    expect(getCodexAuthStatus).not.toHaveBeenCalled();
  });

  it("disables agents that are not connected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <AgentSelectModal
        open={true}
        onClose={vi.fn()}
        onSelect={onSelect}
        connectionStatusByAgent={disconnectedAgents}
      />,
    );

    const claude = screen.getByRole("button", { name: /Claude Code/ });
    const codex = screen.getByRole("button", { name: /Codex CLI/ });
    expect(claude).toBeDisabled();
    expect(codex).toBeDisabled();
    expect(screen.getByText("연결 끊김")).toBeInTheDocument();
    expect(screen.getByText("연결 중")).toBeInTheDocument();

    await user.click(claude);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects and closes when a connected agent is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <AgentSelectModal
        open={true}
        onClose={onClose}
        onSelect={onSelect}
        connectionStatusByAgent={disconnectedAgents}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Gemini CLI/ }));

    expect(onSelect).toHaveBeenCalledWith("gemini");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
