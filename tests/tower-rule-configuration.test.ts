import { describe, expect, it } from "vitest";
import {
  profileMatchesTowerConfiguration,
  towerRuleConfigurationForMode,
  towerRuleConfigurationLabel,
} from "@/lib/tower-rule-configuration";

describe("tower rule configurations", () => {
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
      "NYC Chapter 8 + New York State",
    );
    expect(towerRuleConfigurationLabel("NYS_ONLY")).toBe("New York State Only");
    expect(towerRuleConfigurationLabel("CUSTOM")).toBe("Custom / Out of State");
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
