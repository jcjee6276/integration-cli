import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as tasksApi from "../../api/tasks.api";
import { TaskCreateModal } from "../TaskCreateModal";

vi.mock("../../api/tasks.api", () => ({
  createTask: vi.fn(),
}));

const mockCreateTask = vi.mocked(tasksApi.createTask);

const stubTask = {
  id: "t1",
  title: "Test",
  status: "pending",
  workingDir: null,
  requirements: [],
  agents: [],
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

afterEach(() => { vi.clearAllMocks(); });

describe("TaskCreateModal — open/close", () => {
  it("renders modal when open=true", () => {
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText("새 작업 추가")).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(<TaskCreateModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("새 작업 추가")).not.toBeInTheDocument();
  });

  it("calls onClose when 취소 button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskCreateModal open={true} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("TaskCreateModal — form fields", () => {
  it("renders goal textarea", () => {
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/예: 로그인 페이지/)).toBeInTheDocument();
  });

  it("renders workingDir input", () => {
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("/path/to/project")).toBeInTheDocument();
  });

  it("submit button is disabled when title is empty", () => {
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "작업 생성" })).toBeDisabled();
  });

  it("submit button becomes enabled after title is entered", async () => {
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/예: 로그인 페이지/), "My Task");
    expect(screen.getByRole("button", { name: "작업 생성" })).toBeEnabled();
  });
});

describe("TaskCreateModal — requirements", () => {
  it("adds requirement row when '항목 추가' is clicked", async () => {
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /항목 추가/ }));
    expect(screen.getAllByPlaceholderText("요구사항 입력")).toHaveLength(1);
  });

  it("removes requirement row when X button clicked", async () => {
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /항목 추가/ }));
    const removeBtn = screen.getAllByRole("button").find(
      (b) => !["항목 추가", "에이전트 추가", "취소", "작업 생성", "닫기"].includes(b.textContent?.trim() ?? ""),
    );
    if (removeBtn) await user.click(removeBtn);
    expect(screen.queryByPlaceholderText("요구사항 입력")).not.toBeInTheDocument();
  });
});

describe("TaskCreateModal — agents", () => {
  it("adds agent row when '에이전트 추가' is clicked", async () => {
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /에이전트 추가/ }));
    expect(screen.getByRole("button", { name: "Frontend" })).toBeInTheDocument();
  });

  it("shows frontend as default role for new agent", async () => {
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /에이전트 추가/ }));
    expect(screen.getByText(/UI 구현/)).toBeInTheDocument();
  });
});

describe("TaskCreateModal — submit", () => {
  it("calls createTask with correct payload", async () => {
    mockCreateTask.mockResolvedValueOnce(stubTask);
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/예: 로그인 페이지/), "My Task");
    await user.click(screen.getByRole("button", { name: "작업 생성" }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My Task" }),
      );
    });
  });

  it("calls onCreated callback after successful creation", async () => {
    mockCreateTask.mockResolvedValueOnce(stubTask);
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<TaskCreateModal open={true} onClose={vi.fn()} onCreated={onCreated} />);

    await user.type(screen.getByPlaceholderText(/예: 로그인 페이지/), "My Task");
    await user.click(screen.getByRole("button", { name: "작업 생성" }));

    await waitFor(() => { expect(onCreated).toHaveBeenCalledWith(stubTask); });
  });

  it("shows error message when createTask fails", async () => {
    mockCreateTask.mockRejectedValueOnce(new Error("Server error"));
    const user = userEvent.setup();
    render(<TaskCreateModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/예: 로그인 페이지/), "My Task");
    await user.click(screen.getByRole("button", { name: "작업 생성" }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });
});
