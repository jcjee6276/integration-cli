import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as harnessApi from "../../api/harness.api";
import { HarnessModal } from "../HarnessModal";

vi.mock("../../api/harness.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/harness.api")>("../../api/harness.api");
  return {
    ...actual,
    fetchHarness: vi.fn(),
    saveHarness: vi.fn(),
  };
});

const mockFetchHarness = vi.mocked(harnessApi.fetchHarness);
const mockSaveHarness = vi.mocked(harnessApi.saveHarness);

describe("HarnessModal", () => {
  it("does not render when closed", () => {
    render(<HarnessModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("하네스 설정")).not.toBeInTheDocument();
  });

  it("loads selected role, edits extension/content, and saves", async () => {
    const user = userEvent.setup();
    mockFetchHarness.mockImplementation(async (role) => ({ role, ext: "md", content: `${role} content` }));
    mockSaveHarness.mockResolvedValue({ role: "frontend", ext: "tsx", content: "changed" });

    render(<HarnessModal open={true} onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue("common content")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Frontend" }));
    expect(await screen.findByDisplayValue("frontend content")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ".tsx" }));
    await user.clear(screen.getByDisplayValue("frontend content"));
    await user.type(screen.getByPlaceholderText(/frontend harness/), "changed");

    expect(screen.getByText("저장되지 않은 변경사항이 있습니다")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mockSaveHarness).toHaveBeenCalledWith("frontend", "changed", "tsx"));
  });
});
