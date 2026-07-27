const activityLabels: Record<string, string> = {
  ROUTINE_LEGIONELLA_SAMPLE: "Legionella sample",
  STARTUP_LEGIONELLA_SAMPLE: "Startup Legionella sample",
  POST_HYPERHALOGENATION_SAMPLE: "Post-hyperhalogenation sample",
  CORRECTIVE_RETEST: "Corrective retest",
  EMERGENCY_SAMPLE: "Emergency sample",
  ROUTINE_BACTERIOLOGICAL_SAMPLE: "Bacteriological sample",
  WATER_QUALITY_MONITORING: "Water-quality monitoring",
  COMPLIANCE_INSPECTION: "Compliance inspection",
  ROUTINE_CLEANING: "Routine cleaning",
  STARTUP_CLEANING: "Startup cleaning",
  CLEANING: "Cleaning",
  DISINFECTION: "Disinfection",
  CLEANING_AND_DISINFECTION: "Cleaning and disinfection",
  SUMMERTIME_HYPERHALOGENATION: "Summertime hyperhalogenation",
  CORRECTIVE_DISINFECTION: "Corrective disinfection — biocide adjustment",
  FULL_REMEDIATION: "Full remediation — drain, clean and flush",
  STARTUP: "Startup",
  SHUTDOWN: "Shutdown",
  NO_CIRCULATION_EVENT: "No-circulation event",
  PORTAL_SUBMISSION: "Portal submission",
  LAB_RESULT: "Lab result",
  OWNER_NOTIFICATION: "Owner notification",
  OTHER: "Other activity",
};

export function activityLabel(value: string): string {
  return activityLabels[value] ?? plainEnumLabel(value);
}

export function plainEnumLabel(value: string): string {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatLegionellaResult(value: number | null | undefined) {
  if (value == null) return "No result entered";
  return value === 0 ? "None detected" : `${value} CFU/mL`;
}

export function requirementLabel(value: string): string {
  if (
    value === "ROUTINE_LEGIONELLA_SAMPLE" ||
    value === "ROUTINE_OPERATING_SAMPLE"
  )
    return "Monthly Legionella sample";
  if (value === "POST_DISINFECTION_SAMPLE")
    return "Post-disinfection Legionella sample";
  if (value === "POST_HYPERHALOGENATION_SAMPLE")
    return "Post-hyperhalogenation Legionella sample";
  if (value === "QUARTERLY_COMPLIANCE_INSPECTION")
    return "Quarterly compliance inspection";
  if (value === "STARTUP_CLEANING_DISINFECTION")
    return "Startup cleaning and disinfection";
  if (value === "PORTAL_SAMPLE_DATE") return "NYC portal follow-up";
  if (value === "LAB_RESULT") return "Laboratory result";
  return plainEnumLabel(value);
}

export function requiredActionLabel(value: string): string {
  if (
    value === "ROUTINE_LEGIONELLA_SAMPLE" ||
    value === "ROUTINE_OPERATING_SAMPLE"
  )
    return "Collect the monthly Legionella sample";
  if (value === "STARTUP_SAMPLE")
    return "Collect the Legionella sample required after startup";
  if (value === "POST_HYPERHALOGENATION_SAMPLE")
    return "Collect the post-hyperhalogenation Legionella sample";
  if (value.includes("RETEST")) return "Collect the required Legionella retest";
  if (value === "QUARTERLY_COMPLIANCE_INSPECTION")
    return "Complete the qualified-person compliance inspection";
  if (value === "ANNUAL_CLEANING")
    return "Complete the required annual cleaning";
  if (value === "STARTUP_CLEANING_DISINFECTION")
    return "Complete startup cleaning and disinfection";
  if (value === "PORTAL_SAMPLE_DATE")
    return "Submit the sample date through the NYC portal";
  return requirementLabel(value);
}
