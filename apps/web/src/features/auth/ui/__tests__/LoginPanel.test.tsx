import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginPanel } from "../LoginPanel";
import type { LoginState } from "../../hooks/useClaudeAuth";

function setup(state: LoginState, urls: string[] = [], output = "") {
  const onStart = vi.fn();
  const onCancel = vi.fn();
  render(
    <LoginPanel
      loginState={state}
      loginOutput={output}
      loginUrls={urls}
      onStart={onStart}
      onCancel={onCancel}
    />,
  );
  return { onStart, onCancel };
}

describe("LoginPanel — idle state", () => {
  it("shows login button", () => {
    setup("idle");
    expect(screen.getByRole("button", { name: "Claude Code 로그인" })).toBeInTheDocument();
  });

  it("calls onStart when login button is clicked", async () => {
    const user = userEvent.setup();
    const { onStart } = setup("idle");
    await user.click(screen.getByRole("button", { name: "Claude Code 로그인" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe("LoginPanel — pending state (no URL yet)", () => {
  it("shows spinner when no URLs yet", () => {
    setup("pending");
    expect(screen.getByText(/로그인 프로세스를 시작하는 중/)).toBeInTheDocument();
  });

  it("shows cancel button", () => {
    setup("pending");
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup("pending");
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("LoginPanel — pending state (with URL)", () => {
  it("renders auth URL as link", () => {
    setup("pending", ["https://claude.ai/auth?code=abc"]);
    const link = screen.getByRole("link", { name: "https://claude.ai/auth?code=abc" });
    expect(link).toHaveAttribute("href", "https://claude.ai/auth?code=abc");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows login output text", () => {
    setup("pending", [], "Waiting for authentication...");
    expect(screen.getByText("Waiting for authentication...")).toBeInTheDocument();
  });
});

describe("LoginPanel — done state", () => {
  it("shows success message", () => {
    setup("done");
    expect(screen.getByText("로그인 완료")).toBeInTheDocument();
    expect(screen.getByText("잠시 후 자동으로 이동합니다…")).toBeInTheDocument();
  });

  it("does not show the login button", () => {
    setup("done");
    expect(screen.queryByRole("button", { name: "Claude Code 로그인" })).not.toBeInTheDocument();
  });
});

describe("LoginPanel — error state", () => {
  it("shows error message", () => {
    setup("error");
    expect(screen.getByText(/로그인 중 문제가 발생했습니다/)).toBeInTheDocument();
  });

  it("shows retry button", () => {
    setup("error");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("calls onStart when retry is clicked", async () => {
    const user = userEvent.setup();
    const { onStart } = setup("error");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows error output when provided", () => {
    setup("error", [], "Error: timeout");
    expect(screen.getByText("Error: timeout")).toBeInTheDocument();
  });
});
