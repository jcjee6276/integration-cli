import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "../Modal";

function setup(open = true, onClose = vi.fn()) {
  render(
    <Modal open={open} onClose={onClose} title="Test Modal">
      <p>Modal content</p>
    </Modal>,
  );
  return { onClose };
}

describe("Modal", () => {
  it("renders title and children when open", () => {
    setup();
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    setup(false);
    expect(screen.queryByText("Test Modal")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when ESC key is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides close button when hideClose=true", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="No Close" hideClose>
        content
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument();
  });

  it("applies custom maxWidth class", () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Wide" maxWidth="max-w-3xl">
        content
      </Modal>,
    );
    const dialog = screen.getByText("Wide").closest(".max-w-3xl");
    expect(dialog).toBeInTheDocument();
  });

  it("does not call onClose when clicking inside the modal content", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByText("Modal content"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
