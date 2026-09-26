// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComplianceDate,
  ComplianceTodayProvider,
} from "@/components/compliance-date";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("compliance date", () => {
  it("shows one calendar countdown and one working-day countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T16:00:00.000Z"));
    render(
      <ComplianceTodayProvider>
        <ComplianceDate value="2026-07-21" deadline />
      </ComplianceTodayProvider>,
    );

    expect(screen.getByText("In 5 calendar days")).toBeInTheDocument();
    expect(screen.getByText("3 working days left")).toBeInTheDocument();
    expect(
      screen.queryByText("5 calendar days remaining"),
    ).not.toBeInTheDocument();
  });

  it("describes past records as history rather than overdue work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T16:00:00.000Z"));
    render(
      <ComplianceTodayProvider>
        <ComplianceDate value="2026-07-10" label="Sample collected" compact />
      </ComplianceTodayProvider>,
    );

    expect(screen.getByText("6 calendar days ago")).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });
});
