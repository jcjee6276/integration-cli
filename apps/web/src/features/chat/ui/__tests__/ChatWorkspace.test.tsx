import { createRef } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UnifiedSessionState } from "../../hooks/useUnifiedSessions";
import { ChatWorkspace } from "../ChatWorkspace";

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock("rehype-highlight", () => ({ default: () => {} }));
vi.mock("remark-gfm", () => ({ default: () => {} }));

function renderWorkspace(session: UnifiedSessionState) {
  return render(
    <ChatWorkspace
      selectedSession={session}
      selectedSessionDir=""
      overallConnectionStatus="connected"
      currentDir=""
      error={null}
      inputDisabled={false}
      bottomRef={createRef<HTMLDivElement>()}
      onTerminateSession={vi.fn()}
      onSend={vi.fn()}
      onSendMessage={vi.fn()}
      onDirChange={vi.fn()}
    />,
  );
}

function session(overrides: Partial<UnifiedSessionState> = {}): UnifiedSessionState {
  return {
    info: { id: "session-1", title: "Claude", createdAt: "2024-01-01" },
    messages: [],
    streaming: "",
    isWaiting: false,
    messagesLoaded: true,
    agentId: "claude",
    ...overrides,
  };
}

describe("ChatWorkspace", () => {
  it("renders malformed permission messages as system fallback", () => {
    renderWorkspace(
      session({
        messages: [
          {
            id: "permission-1",
            role: "permission",
            content: "{bad json",
            createdAt: new Date("2024-01-01"),
          },
        ],
      }),
    );

    expect(screen.getByText("system")).toBeInTheDocument();
    expect(screen.getByText(/권한 요청을 표시할 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/\{bad json/)).toBeInTheDocument();
  });
});
