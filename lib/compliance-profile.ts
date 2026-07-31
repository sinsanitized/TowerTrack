export type ComplianceJurisdiction = "NYC" | "NYS" | "CUSTOM";

export function complianceJurisdictionForConfiguration(
  configuration: string,
): ComplianceJurisdiction {
  if (configuration === "NYC_AND_NYS") return "NYC";
  if (configuration === "NYS_ONLY") return "NYS";
  return "CUSTOM";
}

export function complianceJurisdictionForMode(
  mode: string,
): ComplianceJurisdiction {
  if (mode === "NYC_CHAPTER_8_2026_PLUS_NYS_PART_4") return "NYC";
  if (mode === "NYS_PART_4_ONLY") return "NYS";
  return "CUSTOM";
}

export function complianceJurisdictionLabel(
  jurisdiction: ComplianceJurisdiction,
) {
  if (jurisdiction === "NYC") return "New York City";
  if (jurisdiction === "NYS") return "New York State outside NYC";
  return "Custom / Out of State";
}

export function profileSourceLabel(jurisdiction: ComplianceJurisdiction) {
  if (jurisdiction === "NYC")
    return "NYC Chapter 8 + New York State requirements";
  if (jurisdiction === "NYS") return "New York State requirement";
  return "Company or customer policy";
}
