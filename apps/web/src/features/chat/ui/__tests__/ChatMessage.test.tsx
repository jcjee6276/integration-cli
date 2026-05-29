import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatMessage, StreamingMessage, SystemMessage } from "../ChatMessage";
import type { ChatMessage as ChatMessageType } from "../../hooks/useClaudeSessions";

// react-markdown과 highlight 관련 패키지를 단순화하여 테스트 복잡도 낮춤
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock("rehype-highlight", () => ({ default: () => {} }));
vi.mock("remark-gfm", () => ({ default: () => {} }));

function msg(overrides: Partial<ChatMessageType>): ChatMessageType {
  return {
    id: "1",
    role: "user",
    content: "hello",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("ChatMessage — user", () => {
  it("renders content in blue bubble", () => {
    render(<ChatMessage message={msg({ role: "user", content: "user text" })} />);
    expect(screen.getByText("user text")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("renders user avatar on the right side", () => {
    const { container } = render(<ChatMessage message={msg({ role: "user" })} />);
    expect(container.firstChild).toHaveClass("justify-end");
  });
});

describe("ChatMessage — assistant", () => {
  it("renders content via markdown", () => {
    render(<ChatMessage message={msg({ role: "assistant", content: "ai response" })} />);
    expect(screen.getByTestId("markdown")).toHaveTextContent("ai response");
  });

  it("renders C avatar on the left side", () => {
    const { container } = render(<ChatMessage message={msg({ role: "assistant" })} />);
    expect(container.firstChild).toHaveClass("justify-start");
  });

  it("renders cost metadata when meta is provided", () => {
    render(
      <ChatMessage
        message={msg({
          role: "assistant",
          meta: { result: "ok", isError: false, durationMs: 2300, costUsd: 0.0012 },
        })}
      />,
    );
    expect(screen.getByText(/2\.3s/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0012/)).toBeInTheDocument();
  });

  it("renders tool use card when toolUses present", () => {
    render(
      <ChatMessage
        message={msg({
          role: "assistant",
          content: "",
          toolUses: [{ tool: "Bash", input: { command: "git status" } }],
        })}
      />,
    );
    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("git status")).toBeInTheDocument();
  });
});

describe("StreamingMessage", () => {
  it("renders content via markdown when content is non-empty", () => {
    render(<StreamingMessage content="partial response..." />);
    expect(screen.getByTestId("markdown")).toHaveTextContent("partial response...");
  });

  it("shows bouncing dots when content is empty", () => {
    const { container } = render(<StreamingMessage content="" />);
    // 3 animated dots rendered as ● characters
    expect(container.querySelectorAll(".animate-bounce")).toHaveLength(3);
  });
});

describe("SystemMessage", () => {
  it("renders content in monospace panel", () => {
    render(<SystemMessage content="status output here" />);
    expect(screen.getByText("status output here")).toBeInTheDocument();
  });

  it("shows system label with ⚡ icon", () => {
    render(<SystemMessage content="x" />);
    expect(screen.getByText("system")).toBeInTheDocument();
    expect(screen.getByText("⚡")).toBeInTheDocument();
  });

  it("preserves whitespace (pre-wrap)", () => {
    const { container } = render(<SystemMessage content="line1\nline2" />);
    const content = container.querySelector(".whitespace-pre-wrap");
    expect(content).toBeInTheDocument();
  });
});
