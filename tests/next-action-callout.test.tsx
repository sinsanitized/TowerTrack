// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { NextActionCallout } from "@/components/next-action-callout";

afterEach(cleanup);

describe("next action callout", () => {
  it("uses explicit status text and a direct contextual action", () => {
    render(
      <NextActionCallout
        selection={{
          state: "OVERDUE",
          items: [{}],
          controllingDate: "2026-08-03",
          workingDaysLeft: -1,
          reason: "Its hard deadline has passed.",
          immediate: true,
        }}
        items={[
          {
            id: "obligation-1",
            requiredAction: "Collect Legionella resample",
            hardDueDate: "2026-08-03",
            workingDaysLeft: -1,
            targetDate: "2026-08-01",
            obligationReason: "Required after the previous elevated result.",
            actionLabel: "Record resample",
            actionHref:
              "/systems/tower-1?record=resample&obligation=obligation-1#record-event",
          },
        ]}
      />,
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText(/Overdue by 1 working day/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Record resample" }),
    ).toHaveAttribute(
      "href",
      "/systems/tower-1?record=resample&obligation=obligation-1#record-event",
    );
  });

  it("shows a calm upcoming state without warning language", () => {
    render(
      <NextActionCallout
        selection={{
          state: "UPCOMING_TARGET",
          items: [{}],
          controllingDate: "2026-09-01",
          workingDaysLeft: 20,
          reason: "It has the earliest upcoming target date.",
          immediate: false,
        }}
        items={[
          {
            id: "routine-1",
            requiredAction: "Collect routine Legionella sample",
            hardDueDate: "2026-09-08",
            workingDaysLeft: 20,
            targetDate: "2026-09-01",
            obligationReason: "Routine operating sample.",
            actionLabel: "Record sample",
            actionHref:
              "/systems/tower-1?record=sample&obligation=routine-1#record-event",
          },
        ]}
      />,
    );
    expect(
      screen.getByText("No immediate action required"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Next upcoming obligation:/)).toBeInTheDocument();
    expect(screen.getByText("Target date:")).toBeInTheDocument();
  });

  it("shows each obligation's own working-day distance", () => {
    render(
      <NextActionCallout
        selection={{
          state: "DUE_SOON",
          items: [{}, {}],
          controllingDate: "2026-08-03",
          workingDaysLeft: 99,
          reason: "Their hard deadlines require attention.",
          immediate: true,
        }}
        items={[
          {
            id: "first",
            requiredAction: "First action",
            hardDueDate: "2026-08-03",
            workingDaysLeft: -1,
            targetDate: null,
            obligationReason: "First reason.",
            actionLabel: "Record first",
            actionHref: "/first",
          },
          {
            id: "second",
            requiredAction: "Second action",
            hardDueDate: "2026-08-06",
            workingDaysLeft: 2,
            targetDate: null,
            obligationReason: "Second reason.",
            actionLabel: "Record second",
            actionHref: "/second",
          },
        ]}
      />,
    );
    expect(screen.getByText("Overdue by 1 working day")).toBeInTheDocument();
    expect(screen.getByText("2 working days left")).toBeInTheDocument();
    expect(screen.queryByText(/99 working days/)).not.toBeInTheDocument();
  });
});
