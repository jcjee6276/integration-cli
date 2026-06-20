import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/features/tasks/api/tasks.api";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Archived task",
    status: "completed",
    workingDir: null,
    requirements: [],
    agents: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function setupModule() {
  vi.resetModules();

  const fetchArchivedTasks = vi.fn();
  const unarchiveTask = vi.fn();
  const deleteTask = vi.fn();

  vi.doMock("@/features/tasks/api/tasks.api", () => ({
    fetchArchivedTasks,
    unarchiveTask,
    deleteTask,
  }));

  const { FloatingActionPanel } = await import("../FloatingActionPanel");

  return {
    FloatingActionPanel,
    fetchArchivedTasks,
    unarchiveTask,
    deleteTask,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.doUnmock("@/features/tasks/api/tasks.api");
});

describe("FloatingActionPanel", () => {
  it("shares the archive request so StrictMode mount effects do not fetch twice", async () => {
    const user = userEvent.setup();
    const { FloatingActionPanel, fetchArchivedTasks } = await setupModule();
    let resolveTasks!: (tasks: Task[]) => void;

    fetchArchivedTasks.mockReturnValue(
      new Promise<Task[]>((resolve) => {
        resolveTasks = resolve;
      }),
    );

    render(
      <StrictMode>
        <FloatingActionPanel />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "작업 보관함 / 프로젝트" }));

    expect(fetchArchivedTasks).toHaveBeenCalledTimes(1);
    expect(screen.getByText("불러오는 중…")).toBeInTheDocument();

    await act(async () => {
      resolveTasks([task()]);
    });

    expect(await screen.findByText("Archived task")).toBeInTheDocument();
    expect(fetchArchivedTasks).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached archive when the panel is reopened", async () => {
    const user = userEvent.setup();
    const { FloatingActionPanel, fetchArchivedTasks } = await setupModule();
    fetchArchivedTasks.mockResolvedValue([task()]);

    render(<FloatingActionPanel />);

    await user.click(screen.getByRole("button", { name: "작업 보관함 / 프로젝트" }));
    expect(await screen.findByText("Archived task")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "작업 보관함 / 프로젝트" }));
    await user.click(screen.getByRole("button", { name: "작업 보관함 / 프로젝트" }));

    expect(await screen.findByText("Archived task")).toBeInTheDocument();
    expect(fetchArchivedTasks).toHaveBeenCalledTimes(1);
  });

  it("shows action progress while deleting an archived task", async () => {
    const user = userEvent.setup();
    const { FloatingActionPanel, fetchArchivedTasks, deleteTask } = await setupModule();
    let resolveDelete!: () => void;

    fetchArchivedTasks.mockResolvedValue([task()]);
    deleteTask.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    render(<FloatingActionPanel />);

    await user.click(screen.getByRole("button", { name: "작업 보관함 / 프로젝트" }));
    expect(await screen.findByText("Archived task")).toBeInTheDocument();

    const deleteButton = screen.getByTitle("삭제");
    await user.click(deleteButton);

    expect(deleteTask).toHaveBeenCalledWith("task-1");
    expect(deleteButton.querySelector(".animate-spin")).toBeInTheDocument();

    await act(async () => {
      resolveDelete();
    });

    await waitFor(() => {
      expect(screen.queryByText("Archived task")).not.toBeInTheDocument();
    });
  });
});
