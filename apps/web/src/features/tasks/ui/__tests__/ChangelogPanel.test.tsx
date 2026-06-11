import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as changelogApi from "../../api/changelog.api";
import type { TaskAgent } from "../../api/tasks.api";
import { useTaskChangelog } from "../../hooks/useTaskChangelog";
import { ChangelogPanel } from "../ChangelogPanel";

vi.mock("../../hooks/useTaskChangelog", () => ({
  useTaskChangelog: vi.fn(),
}));

vi.mock("../../api/changelog.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/changelog.api")>("../../api/changelog.api");
  return {
    ...actual,
    mergeAgentAll: vi.fn(),
    mergeAgentFile: vi.fn(),
  };
});

const mockUseTaskChangelog = vi.mocked(useTaskChangelog);
const mockMergeAll = vi.mocked(changelogApi.mergeAgentAll);
const mockMergeFile = vi.mocked(changelogApi.mergeAgentFile);

const agents: TaskAgent[] = [
  { id: 1, agentType: "claude", role: "frontend", customRole: null, status: "completed" },
];

const changelogs = [
  {
    agentId: 1,
    files: [
      {
        id: 1,
        filePath: "src/App.tsx",
        changeType: "modified" as const,
        additions: 2,
        deletions: 1,
        patch: "diff --git\n@@ -1 +1 @@\n-old\n+new",
      },
    ],
  },
];

describe("ChangelogPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading, error, and empty states", () => {
    mockUseTaskChangelog.mockReturnValueOnce({ changelogs: [], loading: true, error: null });
    const { container, rerender } = render(<ChangelogPanel taskId="task-1" agents={agents} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);

    mockUseTaskChangelog.mockReturnValueOnce({ changelogs: [], loading: false, error: "diff failed" });
    rerender(<ChangelogPanel taskId="task-1" agents={agents} />);
    expect(screen.getByText("diff failed")).toBeInTheDocument();

    mockUseTaskChangelog.mockReturnValueOnce({ changelogs: [], loading: false, error: null });
    rerender(<ChangelogPanel taskId="task-1" agents={agents} />);
    expect(screen.getByText(/변경사항이 없거나/)).toBeInTheDocument();
  });

  it("renders files, toggles patch, and merges all/file", async () => {
    mockUseTaskChangelog.mockReturnValue({ changelogs, loading: false, error: null });
    mockMergeAll.mockResolvedValue({ success: true, message: "ok" });
    mockMergeFile.mockResolvedValue({ success: false, message: "conflict" });
    const user = userEvent.setup();

    render(<ChangelogPanel taskId="task-1" agents={agents} />);

    expect(screen.getByText("Claude · frontend")).toBeInTheDocument();
    expect(screen.getByText("src/")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getAllByText("+2")).toHaveLength(2);
    expect(screen.getAllByText("-1")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /수정.*App\.tsx/s }));
    expect(screen.getByText("+new")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "src/App.tsx 변경 코드 복사" }));
    expect(screen.getByText("복사됨")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "전체 병합" }));
    await waitFor(() => expect(mockMergeAll).toHaveBeenCalledWith("task-1", 1));
    expect(screen.getByText((text) => text.includes("병합 완료"))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "병합" }));
    await waitFor(() => expect(mockMergeFile).toHaveBeenCalledWith("task-1", 1, "src/App.tsx"));
    expect(screen.getByText((text) => text.includes("conflict"))).toBeInTheDocument();
  });
});
