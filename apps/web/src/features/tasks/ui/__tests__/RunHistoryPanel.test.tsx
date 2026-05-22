import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TaskAgent, TaskRun } from "../../api/tasks.api";
import { useTaskRuns } from "../../hooks/useTaskRuns";
import { RunHistoryPanel } from "../RunHistoryPanel";

vi.mock("../../hooks/useTaskRuns", () => ({
  useTaskRuns: vi.fn(),
}));

const mockUseTaskRuns = vi.mocked(useTaskRuns);

const agents: TaskAgent[] = [
  { id: 1, agentType: "claude", role: "frontend", customRole: null, status: "completed" },
];

const runs: TaskRun[] = [
  {
    id: 1,
    version: 2,
    supplementNote: "보완 요청",
    status: "completed",
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:00:03.000Z",
    agentRuns: [
      { id: 10, agentId: 1, status: "completed", worktreePath: null, startCommitHash: null, durationMs: 1500, costUsd: 0.01 },
    ],
  },
  {
    id: 2,
    version: 1,
    supplementNote: null,
    status: "error",
    startedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
    agentRuns: [],
  },
];

describe("RunHistoryPanel", () => {
  it("renders loading skeleton", () => {
    mockUseTaskRuns.mockReturnValue({ runs: [], loading: true, error: null });
    const { container } = render(<RunHistoryPanel taskId="task-1" agents={agents} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });

  it("renders error state", () => {
    mockUseTaskRuns.mockReturnValue({ runs: [], loading: false, error: "failed" });
    render(<RunHistoryPanel taskId="task-1" agents={agents} />);
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockUseTaskRuns.mockReturnValue({ runs: [], loading: false, error: null });
    render(<RunHistoryPanel taskId="task-1" agents={agents} />);
    expect(screen.getByText("실행 기록이 없습니다")).toBeInTheDocument();
  });

  it("renders run history, latest badge, supplement note, duration, and cost", () => {
    mockUseTaskRuns.mockReturnValue({ runs, loading: false, error: null });
    render(<RunHistoryPanel taskId="task-1" agents={agents} />);

    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("최신")).toBeInTheDocument();
    expect(screen.getByText("보완 요청")).toBeInTheDocument();
    expect(screen.getByText("3s")).toBeInTheDocument();
    expect(screen.getByText("$0.0100")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });
});
