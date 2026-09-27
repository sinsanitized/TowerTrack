// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComplianceRuleProfileFields } from "@/components/compliance-rule-profile-fields";

const jurisdictions = [
  { id: "nyc-j", label: "New York, NY", state: "NY", city: "New York" },
  { id: "nys-j", label: "Westchester, NY", state: "NY", city: null },
  { id: "nj-j", label: "Newark, NJ", state: "NJ", city: null },
  { id: "nj-trenton", label: "Trenton, NJ", state: "NJ", city: "Trenton" },
  { id: "pa-j", label: "PA", state: "PA", city: null },
];
const profiles = [
  {
    id: "nyc",
    name: "NYC profile",
    jurisdictionMode: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
    jurisdictionId: "nyc-j",
  },
  {
    id: "nys",
    name: "NYS profile",
    jurisdictionMode: "NYS_PART_4_ONLY",
    jurisdictionId: "nys-j",
  },
  {
    id: "nj-pending",
    name: "Pending New Jersey review",
    jurisdictionMode: "PENDING_REGULATION",
    jurisdictionId: null,
  },
  {
    id: "policy",
    name: "Company policy",
    jurisdictionMode: "OUT_OF_STATE_COMPANY_POLICY",
    jurisdictionId: null,
  },
];

afterEach(cleanup);

describe("compliance rule profile fields", () => {
  it("derives the program and profile from tower jurisdiction", () => {
    const { container } = render(
      <ComplianceRuleProfileFields
        profiles={profiles}
        jurisdictions={jurisdictions}
      />,
    );
    const jurisdiction = screen.getByLabelText(/Tower jurisdiction/);
    fireEvent.change(jurisdiction, { target: { value: "nyc-j" } });
    expect(screen.getByText("New York City regulatory program")).toBeTruthy();
    expect(screen.getByText(/NYC Chapter 8 and NYS Part 4 apply/)).toBeTruthy();
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="ruleConfiguration"]',
      )?.value,
    ).toBe("NYC_AND_NYS");
    expect(
      container.querySelector<HTMLInputElement>('input[name="ruleProfileId"]')
        ?.value,
    ).toBe("nyc");

    fireEvent.change(jurisdiction, { target: { value: "nys-j" } });
    expect(screen.getByText("New York State regulatory program")).toBeTruthy();
    expect(screen.getByText(/NYC Chapter 8 does not apply/)).toBeTruthy();
  });

  it("shows New Jersey as monitoring-only instead of an active rule", () => {
    const view = render(
      <ComplianceRuleProfileFields
        profiles={profiles}
        jurisdictions={jurisdictions}
      />,
    );
    fireEvent.change(view.getByLabelText(/Tower jurisdiction/), {
      target: { value: "nj-j" },
    });
    expect(screen.getByText("New Jersey regulation monitoring")).toBeTruthy();
    expect(screen.getByText(/will not generate legal deadlines/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Tower jurisdiction/), {
      target: { value: "nj-trenton" },
    });
    expect(screen.getByText("New Jersey regulation monitoring")).toBeTruthy();
    expect(
      view.container.querySelector<HTMLInputElement>(
        'input[name="ruleProfileId"]',
      )?.value,
    ).toBe("nj-pending");
  });
});
