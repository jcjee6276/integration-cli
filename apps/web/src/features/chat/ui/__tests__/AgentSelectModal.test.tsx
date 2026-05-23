import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentSelectModal } from "../AgentSelectModal";

const disconnectedAgents = {
  claude: "disconnected",
  gemini: "connected",
  codex: "connecting",
  opencode: "disconnected",
} as const;

describe("AgentSelectModal", () => {
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
