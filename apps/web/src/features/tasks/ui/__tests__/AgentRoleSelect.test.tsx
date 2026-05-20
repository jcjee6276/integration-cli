import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentRoleBadge, AgentRow } from "../AgentRoleSelect";
import type { AgentDraft } from "../../hooks/useTaskCreate";

function draft(overrides: Partial<AgentDraft> = {}): AgentDraft {
  return { id: "d1", agentType: "claude", role: "frontend", customRole: "", ...overrides };
}

describe("AgentRow — role buttons", () => {
  it("renders all 5 role buttons", () => {
    render(<AgentRow agent={draft()} onChange={vi.fn()} onRemove={vi.fn()} />);
    ["Frontend", "Backend", "Doc", "Operation", "Other"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("calls onChange with new role when button clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AgentRow agent={draft({ role: "frontend" })} onChange={onChange} onRemove={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Backend" }));

    expect(onChange).toHaveBeenCalledWith({ role: "backend" });
  });

  it("calls onRemove when delete button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<AgentRow agent={draft()} onChange={vi.fn()} onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: "에이전트 삭제" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("AgentRow — role=other", () => {
  it("shows custom role input when role is other", () => {
    render(<AgentRow agent={draft({ role: "other" })} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByPlaceholderText("역할을 직접 입력하세요")).toBeInTheDocument();
  });

  it("hides custom input for non-other roles", () => {
    render(<AgentRow agent={draft({ role: "frontend" })} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByPlaceholderText("역할을 직접 입력하세요")).not.toBeInTheDocument();
  });

  it("calls onChange with customRole on every keystroke", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AgentRow agent={draft({ role: "other" })} onChange={onChange} onRemove={vi.fn()} />);

    // Since this is a controlled input, each keystroke calls onChange once.
    await user.type(screen.getByPlaceholderText("역할을 직접 입력하세요"), "D");

    expect(onChange).toHaveBeenCalledWith({ customRole: "D" });
  });
});

describe("AgentRow — frontend description hint", () => {
  it("shows description hint for frontend", () => {
    render(<AgentRow agent={draft({ role: "frontend" })} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/UI 구현/)).toBeInTheDocument();
  });

  it("does not show hint for backend", () => {
    render(<AgentRow agent={draft({ role: "backend" })} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByText(/UI 구현/)).not.toBeInTheDocument();
  });
});

describe("AgentRoleBadge", () => {
  it("renders role label", () => {
    render(<AgentRoleBadge role="frontend" />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("renders customRole for other when provided", () => {
    render(<AgentRoleBadge role="other" customRole="DevOps" />);
    expect(screen.getByText("DevOps")).toBeInTheDocument();
  });

  it('renders "Other" when customRole is null', () => {
    render(<AgentRoleBadge role="other" customRole={null} />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });
});
