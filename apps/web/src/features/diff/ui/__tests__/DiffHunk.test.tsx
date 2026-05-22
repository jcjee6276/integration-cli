import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiffHunk } from "../DiffHunk";

describe("DiffHunk", () => {
  it("renders hunk, context, added, and removed lines with line numbers", () => {
    render(
      <DiffHunk
        lines={[
          { type: "hunk", content: "@@ -1,2 +1,2 @@" },
          { type: "context", content: "const a = 1;", oldLineNo: 1, newLineNo: 1 },
          { type: "removed", content: "const b = 2;", oldLineNo: 2 },
          { type: "added", content: "const b = 3;", newLineNo: 2 },
        ]}
      />,
    );

    expect(screen.getByText("@@ -1,2 +1,2 @@")).toBeInTheDocument();
    expect(screen.getByText("const a = 1;")).toBeInTheDocument();
    expect(screen.getByText("const b = 2;")).toBeInTheDocument();
    expect(screen.getByText("const b = 3;")).toBeInTheDocument();
  });
});
