import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Task } from "../../api/tasks.api";
import * as tasksApi from "../../api/tasks.api";
import { TaskEditModal } from "../TaskEditModal";

vi.mock("../../api/tasks.api", () => ({
  updateTask: vi.fn(),
}));

const mockUpdateTask = vi.mocked(tasksApi.updateTask);

const task: Task = {
  id: "task-1",
  title: "Original title",
  status: "pending",
  workingDir: "/repo",
  requirements: [{ id: 1, content: "First req", status: "pending", orderIndex: 0 }],
  agents: [{ id: 1, agentType: "claude", role: "frontend", customRole: null, status: "pending" }],
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

afterEach(() => { vi.clearAllMocks(); });

describe("TaskEditModal", () => {
  it("renders existing task fields and closes on cancel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskEditModal task={task} onClose={onClose} onSaved={vi.fn()} />);

    expect(screen.getByText("작업 수정")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original title")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/repo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("First req")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds requirement and agent, then saves", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const updated = { ...task, title: "Changed" };
    mockUpdateTask.mockResolvedValueOnce(updated);
    render(<TaskEditModal task={{ ...task, requirements: [], agents: [] }} onClose={onClose} onSaved={onSaved} />);

    const title = screen.getByPlaceholderText(/예: 로그인 페이지/);
    await user.clear(title);
    await user.type(title, "Changed");
    await user.click(screen.getByRole("button", { name: /항목 추가/ }));
    await user.type(screen.getByPlaceholderText("요구사항 입력"), "Req");
    await user.click(screen.getByRole("button", { name: /에이전트 추가/ }));
    await user.click(screen.getByRole("button", { name: /Codex CLI/ }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows API error", async () => {
    const user = userEvent.setup();
    mockUpdateTask.mockRejectedValueOnce(new Error("save failed"));
    render(<TaskEditModal task={task} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });
});
