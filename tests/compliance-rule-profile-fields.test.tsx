// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplianceRuleProfileFields } from "@/components/compliance-rule-profile-fields";

const profiles = [
  {
    id: "nyc",
    name: "NYC profile",
    jurisdictionMode: "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
  },
  {
    id: "nys",
    name: "NYS profile",
    jurisdictionMode: "NYS_PART_4_ONLY",
  },
  {
    id: "custom",
    name: "Custom profile",
    jurisdictionMode: "CUSTOM_JURISDICTION",
  },
];

describe("compliance rule profile fields", () => {
  it("only offers profiles compatible with the visible configuration choice", () => {
    render(<ComplianceRuleProfileFields profiles={profiles} />);

    const profile = screen.getByLabelText(
      "Profile version",
    ) as HTMLSelectElement;
    expect(profile.disabled).toBe(true);

    fireEvent.click(
      screen.getByRole("radio", { name: /NYC Chapter 8 and NYS Part 4/ }),
    );
    expect(profile.disabled).toBe(false);
    expect(screen.getByRole("option", { name: "NYC profile" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "NYS profile" })).toBeNull();

    fireEvent.change(profile, { target: { value: "nyc" } });
    expect(
      screen.getByText("Selected rule assignment:").parentElement?.textContent,
    ).toContain(
      "Selected rule assignment: NYC Chapter 8 and NYS Part 4 — NYC profile",
    );

    fireEvent.click(screen.getByRole("radio", { name: /NYS Part 4 only/ }));
    expect(profile.value).toBe("");
    expect(screen.getByRole("option", { name: "NYS profile" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "NYC profile" })).toBeNull();
  });
});
