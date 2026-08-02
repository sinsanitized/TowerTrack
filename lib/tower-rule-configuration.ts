import type { TowerRuleConfiguration } from "@prisma/client";

export const towerRuleConfigurationValues = [
  "NYC_AND_NYS",
  "NYS_ONLY",
  "CUSTOM",
] as const satisfies readonly TowerRuleConfiguration[];

export function towerRuleConfigurationForMode(
  jurisdictionMode: string,
): TowerRuleConfiguration {
  if (jurisdictionMode === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4")
    return "NYC_AND_NYS";
  if (jurisdictionMode === "NYS_PART_4_ONLY") return "NYS_ONLY";
  return "CUSTOM";
}

export function towerRuleConfigurationLabel(
  configuration: TowerRuleConfiguration,
) {
  if (configuration === "NYC_AND_NYS") return "NYC Chapter 8 and NYS Part 4";
  if (configuration === "NYS_ONLY") return "NYS Part 4 only";
  return "Custom or out-of-state";
}

export function profileMatchesTowerConfiguration(
  configuration: TowerRuleConfiguration,
  jurisdictionMode: string,
) {
  if (configuration === "NYC_AND_NYS")
    return jurisdictionMode === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4";
  if (configuration === "NYS_ONLY")
    return jurisdictionMode === "NYS_PART_4_ONLY";
  return !["NYC_CHAPTER_8_2026_PLUS_NYS_PART_4", "NYS_PART_4_ONLY"].includes(
    jurisdictionMode,
  );
}
