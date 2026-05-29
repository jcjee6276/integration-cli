import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FileChangeBadge } from "../FileChangeBadge";

describe("FileChangeBadge", () => {
  it.each([
    ["added", "추가"],
    ["modified", "수정"],
    ["deleted", "삭제"],
    ["renamed", "이동"],
  ] as const)("renders %s label", (type, label) => {
    render(<FileChangeBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
