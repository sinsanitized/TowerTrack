import { describe, expect, it } from "vitest";
import {
  canViewTowerSettings,
  resolveTowerDetailView,
  selectOverviewObligations,
} from "@/lib/tower-details";

const obligation = (id: string, latest: string, priority = "ROUTINE") => ({
  id,
  latest,
  priority,
  targetStart: null,
  targetEnd: null,
});

describe("tower detail workspace", () => {
  it("shows every urgent obligation and only the next three non-urgent obligations", () => {
    const selected = selectOverviewObligations(
      [
        obligation("urgent-overdue", "2026-07-29"),
        obligation("urgent-one", "2026-07-31"),
        obligation("urgent-two", "2026-08-03"),
        obligation("upcoming-four", "2026-09-04"),
        obligation("upcoming-two", "2026-09-02"),
        obligation("upcoming-one", "2026-09-01"),
        obligation("upcoming-three", "2026-09-03"),
      ],
      "2026-07-30",
    );

    expect(selected.map(({ id }) => id)).toEqual([
      "urgent-overdue",
      "urgent-one",
      "urgent-two",
      "upcoming-one",
      "upcoming-two",
      "upcoming-three",
    ]);
  });

  it("keeps Settings unavailable to technicians and schedulers", () => {
    expect(canViewTowerSettings("TECHNICIAN")).toBe(false);
    expect(canViewTowerSettings("SCHEDULER")).toBe(false);
    expect(resolveTowerDetailView("settings", "TECHNICIAN")).toBe("overview");
    expect(resolveTowerDetailView("settings", "SCHEDULER")).toBe("overview");
    expect(resolveTowerDetailView("settings", "ADMIN")).toBe("settings");
    expect(resolveTowerDetailView("settings", "OPERATIONS_MANAGER")).toBe(
      "settings",
    );
  });
});
