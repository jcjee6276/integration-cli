import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DiffFileRow } from "../DiffFileRow";

const file = {
  filePath: "src/features/App.tsx",
  changeType: "modified" as const,
  additions: 2,
  deletions: 1,
  lines: [
    { type: "hunk" as const, content: "@@" },
    { type: "added" as const, content: "new line", newLineNo: 10 },
  ],
};

describe("DiffFileRow", () => {
  it("renders file metadata and opens diff by default when requested", () => {
    render(<DiffFileRow file={file} defaultOpen={true} />);

    expect(screen.getByText("src/features/")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("수정")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("new line")).toBeInTheDocument();
  });

  it("toggles diff contents when clicked", async () => {
    const user = userEvent.setup();
    render(<DiffFileRow file={file} />);

    expect(screen.queryByText("new line")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("new line")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("new line")).not.toBeInTheDocument();
  });
});
