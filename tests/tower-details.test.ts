import { describe, expect, it } from "vitest";
import {
  canViewTowerSettings,
  resolveTowerDetailView,
  selectNextTowerActions,
  selectOverviewObligations,
} from "@/lib/tower-details";

const obligation = (
  id: string,
  latest: string | null,
  priority = "ROUTINE",
) => ({
  id,
  latest,
  priority,
  targetStart: null,
  targetEnd: null,
  status: "PENDING",
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

  it("selects overdue work before every other action", () => {
    const selected = selectNextTowerActions(
      [
        { ...obligation("upcoming", "2026-08-20"), targetStart: "2026-08-10" },
        obligation("overdue", "2026-08-03"),
        obligation("due-soon", "2026-08-06"),
      ],
      "2026-08-04",
    );
    expect(selected.state).toBe("OVERDUE");
    expect(selected.items.map(({ id }) => id)).toEqual(["overdue"]);
  });

  it("selects deadlines within three working days before upcoming targets", () => {
    const selected = selectNextTowerActions(
      [
        { ...obligation("target", "2026-09-01"), targetStart: "2026-08-04" },
        obligation("due-soon", "2026-08-07"),
      ],
      "2026-08-04",
    );
    expect(selected.state).toBe("DUE_SOON");
    expect(selected.workingDaysLeft).toBe(3);
    expect(selected.items[0].id).toBe("due-soon");
  });

  it("surfaces missing-deadline blockers before upcoming work", () => {
    const selected = selectNextTowerActions(
      [
        obligation("review", null),
        { ...obligation("target", "2026-09-01"), targetStart: "2026-08-10" },
      ],
      "2026-08-04",
    );
    expect(selected.state).toBe("REVIEW_REQUIRED");
    expect(selected.items[0].id).toBe("review");
  });

  it("uses the earliest target date for upcoming actions", () => {
    const selected = selectNextTowerActions(
      [
        { ...obligation("later", "2026-09-10"), targetStart: "2026-09-02" },
        { ...obligation("earlier", "2026-09-10"), targetStart: "2026-09-01" },
      ],
      "2026-08-04",
    );
    expect(selected.state).toBe("UPCOMING_TARGET");
    expect(selected.items[0].id).toBe("earlier");
  });

  it("falls back to the earliest hard deadline when targets are unavailable", () => {
    const selected = selectNextTowerActions(
      [obligation("later", "2026-09-10"), obligation("earlier", "2026-09-08")],
      "2026-08-04",
    );
    expect(selected.state).toBe("UPCOMING_DEADLINE");
    expect(selected.items[0].id).toBe("earlier");
  });

  it("groups actions tied at the highest priority and deadline", () => {
    const selected = selectNextTowerActions(
      [
        obligation("one", "2026-08-07"),
        obligation("two", "2026-08-07"),
        obligation("later", "2026-08-08"),
      ],
      "2026-08-04",
    );
    expect(selected.items.map(({ id }) => id)).toEqual(["one", "two"]);
  });

  it("removes completed work and immediately promotes the next action", () => {
    const before = [
      obligation("first", "2026-08-06"),
      obligation("next", "2026-08-20"),
    ];
    expect(selectNextTowerActions(before, "2026-08-04").items[0].id).toBe(
      "first",
    );
    const after = before.map((item) =>
      item.id === "first" ? { ...item, status: "COMPLETED" } : item,
    );
    expect(selectNextTowerActions(after, "2026-08-04").items[0].id).toBe(
      "next",
    );
  });
});
