import { describe, expect, it } from "vitest";
import {
  profileMatchesTowerConfiguration,
  towerRuleConfigurationForJurisdiction,
  towerRuleConfigurationForMode,
  towerRuleConfigurationLabel,
} from "@/lib/tower-rule-configuration";

describe("tower rule configurations", () => {
  it.each([
    [{ state: "NY", city: "New York" }, "NYC_AND_NYS"],
    [{ state: "NY", city: "White Plains" }, "NYS_ONLY"],
    [{ state: "NY", city: "Albany" }, "NYS_ONLY"],
    [{ state: "NY", city: null }, "NYS_ONLY"],
    [{ state: "NJ", city: "Newark" }, "CUSTOM"],
  ])("derives $expected from $jurisdiction", (jurisdiction, expected) => {
    expect(towerRuleConfigurationForJurisdiction(jurisdiction)).toBe(expected);
  });

  it.each([
    ["NYC_CHAPTER_8_2026_PLUS_NYS_PART_4", "NYC_AND_NYS"],
    ["NYS_PART_4_ONLY", "NYS_ONLY"],
    ["CUSTOM_JURISDICTION", "CUSTOM"],
    ["OUT_OF_STATE_COMPANY_POLICY", "CUSTOM"],
  ])("maps %s to %s", (mode, configuration) => {
    expect(towerRuleConfigurationForMode(mode)).toBe(configuration);
  });

  it("exposes the three required plain-English choices", () => {
    expect(towerRuleConfigurationLabel("NYC_AND_NYS")).toBe(
      "NYC Chapter 8 and NYS Part 4",
    );
    expect(towerRuleConfigurationLabel("NYS_ONLY")).toBe("NYS Part 4 only");
    expect(towerRuleConfigurationLabel("CUSTOM")).toBe(
      "Custom or out-of-state",
    );
  });

  it("rejects conflicting base profile selections", () => {
    expect(
      profileMatchesTowerConfiguration("NYC_AND_NYS", "NYS_PART_4_ONLY"),
    ).toBe(false);
    expect(
      profileMatchesTowerConfiguration(
        "NYS_ONLY",
        "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4",
      ),
    ).toBe(false);
    expect(
      profileMatchesTowerConfiguration("CUSTOM", "CUSTOM_JURISDICTION"),
    ).toBe(true);
  });
});
