import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from "../ChatInput";

describe("ChatInput — rendering", () => {
  it("renders textarea and send button", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전송" })).toBeInTheDocument();
  });

  it("shows placeholder text", () => {
    render(<ChatInput onSend={vi.fn()} placeholder="Write here" />);
    expect(screen.getByPlaceholderText("Write here")).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "전송" })).toBeDisabled();
  });

  it("disables textarea when disabled=true", () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

describe("ChatInput — sending", () => {
  it("calls onSend when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "hello{Enter}");

    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("does not call onSend on Shift+Enter (newline)", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "hello{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears input after sending", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "hello{Enter}");

    expect(textarea).toHaveValue("");
  });

  it("does not call onSend when disabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled />);

    await user.type(screen.getByRole("textbox"), "hello");
    await user.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("trims whitespace and sends the trimmed value", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "  hello  {Enter}");

    expect(onSend).toHaveBeenCalledWith("hello");
  });
});

describe("ChatInput — slash menu", () => {
  it("shows slash menu when / is typed", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "/");

    expect(screen.getByText("/status")).toBeInTheDocument();
    expect(screen.getByText("/help")).toBeInTheDocument();
  });

  it("filters menu items by query", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "/sta");

    expect(screen.getByText("/status")).toBeInTheDocument();
    expect(screen.queryByText("/help")).not.toBeInTheDocument();
  });

  it("hides menu on Escape", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "/");
    expect(screen.getByText("/status")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("/status")).not.toBeInTheDocument();
  });

  it("selects a command on Tab and appends space", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "/status");
    await user.keyboard("{Tab}");

    expect(screen.getByRole("textbox")).toHaveValue("/status ");
  });

  it("hides menu after command is selected", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "/status");
    await user.keyboard("{Tab}");

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
