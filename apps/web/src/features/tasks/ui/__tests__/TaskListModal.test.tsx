import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Task } from "../../api/tasks.api";
import { useTaskExecution } from "../../hooks/useTaskExecution";
import { useTaskList } from "../../hooks/useTaskList";
import { TaskListModal } from "../TaskListModal";

vi.mock("../../hooks/useTaskList", () => ({
  useTaskList: vi.fn(),
}));

vi.mock("../../hooks/useTaskExecution", () => ({
  useTaskExecution: vi.fn(),
}));

vi.mock("../AgentOutputPanel", () => ({
  AgentOutputPanel: ({ connected }: { connected: boolean }) => (
    <div data-testid="agent-output">connected:{String(connected)}</div>
  ),
}));

vi.mock("../ChangelogPanel", () => ({
  ChangelogPanel: ({ taskId }: { taskId: string }) => <div data-testid="changelog">changes:{taskId}</div>,
}));

vi.mock("../RunHistoryPanel", () => ({
  RunHistoryPanel: ({ taskId }: { taskId: string }) => <div data-testid="history">history:{taskId}</div>,
}));

const mockUseTaskList = vi.mocked(useTaskList);
const mockUseTaskExecution = vi.mocked(useTaskExecution);

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-123456789",
    title: "Build feature",
    status: "pending",
    workingDir: null,
    requirements: [{ id: 1, content: "Requirement", status: "pending", orderIndex: 0 }],
    agents: [{ id: 1, agentType: "claude", role: "frontend", customRole: null, status: "pending" }],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup(overrides: Partial<ReturnType<typeof useTaskList>> = {}) {
  const defaults = {
    tasks: [task()],
    loading: false,
    actioningId: null,
    error: null,
    editingTask: null,
    setEditingTask: vi.fn(),
    loadTasks: vi.fn(),
    execute: vi.fn(),
    stop: vi.fn(),
    rerun: vi.fn(),
    rerunAgent: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
    onEditDone: vi.fn(),
    updateTaskStatus: vi.fn(),
  };
  const value = { ...defaults, ...overrides };
  mockUseTaskList.mockReturnValue(value);
  mockUseTaskExecution.mockReturnValue({ agentLogs: {}, connected: true });
  render(<TaskListModal open={true} onClose={vi.fn()} />);
  return value;
}

afterEach(() => { vi.clearAllMocks(); });

describe("TaskListModal", () => {
  it("does not render when closed", () => {
    mockUseTaskList.mockReturnValue({
      tasks: [],
      loading: false,
      actioningId: null,
      error: null,
      editingTask: null,
      setEditingTask: vi.fn(),
      loadTasks: vi.fn(),
      execute: vi.fn(),
      stop: vi.fn(),
      rerun: vi.fn(),
      rerunAgent: vi.fn(),
      archive: vi.fn(),
      remove: vi.fn(),
      onEditDone: vi.fn(),
      updateTaskStatus: vi.fn(),
    });
    render(<TaskListModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("작업 목록")).not.toBeInTheDocument();
  });

  it("renders empty, loading, and error states", () => {
    const { rerender, container } = render(<TaskListModal open={true} onClose={vi.fn()} />);
    mockUseTaskList.mockReturnValue({
      tasks: [],
      loading: true,
      actioningId: null,
      error: null,
      editingTask: null,
      setEditingTask: vi.fn(),
      loadTasks: vi.fn(),
      execute: vi.fn(),
      stop: vi.fn(),
      rerun: vi.fn(),
      rerunAgent: vi.fn(),
      archive: vi.fn(),
      remove: vi.fn(),
      onEditDone: vi.fn(),
      updateTaskStatus: vi.fn(),
    });
    rerender(<TaskListModal open={true} onClose={vi.fn()} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);

    mockUseTaskList.mockReturnValue({
      tasks: [],
      loading: false,
      actioningId: null,
      error: "load failed",
      editingTask: null,
      setEditingTask: vi.fn(),
      loadTasks: vi.fn(),
      execute: vi.fn(),
      stop: vi.fn(),
      rerun: vi.fn(),
      rerunAgent: vi.fn(),
      archive: vi.fn(),
      remove: vi.fn(),
      onEditDone: vi.fn(),
      updateTaskStatus: vi.fn(),
    });
    rerender(<TaskListModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText("load failed")).toBeInTheDocument();
    expect(screen.getByText("생성된 작업이 없습니다")).toBeInTheDocument();
  });

  it("refreshes, expands a task, executes, edits, archives, and deletes", async () => {
    const user = userEvent.setup();
    const api = setup();

    await user.click(screen.getByRole("button", { name: /새로고침/ }));
    expect(api.loadTasks).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Build feature/ }));
    expect(screen.getByText("Requirement")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "실행" }));
    expect(api.execute).toHaveBeenCalledWith("task-123456789");

    await user.click(screen.getByRole("button", { name: "수정" }));
    expect(api.setEditingTask).toHaveBeenCalledWith(expect.objectContaining({ id: "task-123456789" }));

    await user.click(screen.getByRole("button", { name: "보관" }));
    expect(api.archive).toHaveBeenCalledWith("task-123456789");

    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(api.remove).toHaveBeenCalledWith("task-123456789");
  });

  it("renders running stop button and logs when expanded", async () => {
    const user = userEvent.setup();
    const api = setup({ tasks: [task({ status: "running" })] });

    await user.click(screen.getByRole("button", { name: /Build feature/ }));

    expect(screen.getByTestId("agent-output")).toHaveTextContent("connected:true");
    await user.click(screen.getByRole("button", { name: "중지" }));
    expect(api.stop).toHaveBeenCalledWith("task-123456789");
  });

  it("switches completed task tabs and submits rerun note", async () => {
    const user = userEvent.setup();
    const api = setup({ tasks: [task({ status: "completed" })] });

    await user.click(screen.getByRole("button", { name: /Build feature/ }));
    await user.click(screen.getByRole("button", { name: "변경사항" }));
    expect(screen.getByTestId("changelog")).toHaveTextContent("changes:task-123456789");
    await user.click(screen.getByRole("button", { name: "실행 기록" }));
    expect(screen.getByTestId("history")).toHaveTextContent("history:task-123456789");

    await user.click(screen.getByRole("button", { name: "재 실행" }));
    await user.type(screen.getByPlaceholderText(/에러 핸들링/), "more tests");
    await user.click(screen.getByRole("button", { name: "재 실행" }));

    await waitFor(() => expect(api.rerun).toHaveBeenCalledWith("task-123456789", "more tests"));
  });
});
