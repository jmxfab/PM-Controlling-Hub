import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SyncButton } from "./sync-button";

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

describe("SyncButton", () => {
  beforeEach(() => {
    refreshMock.mockReset();
  });

  it("refreshes the dashboard when live Hero reads are available", () => {
    render(<SyncButton liveHeroAvailable />);

    fireEvent.click(screen.getByRole("button", { name: /Hero Daten laden/i }));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("stays disabled and exposes a reason when live Hero reads are unavailable", () => {
    render(
      <SyncButton
        liveHeroAvailable={false}
        disabledReason="Live-Hero-Daten können erst geladen werden, wenn HERO_API_KEY gesetzt ist."
      />
    );

    expect(
      screen.getByRole("button", { name: /Hero Daten laden/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Hero Daten laden/i })
    ).toHaveAttribute(
      "title",
      "Live-Hero-Daten können erst geladen werden, wenn HERO_API_KEY gesetzt ist."
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
