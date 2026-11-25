export function plainEnumLabel(value: string): string {
  const text = lowercaseWithJurisdictionAcronyms(value.replaceAll("_", " "));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function lowercaseWithJurisdictionAcronyms(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/\bnyc\b/g, "NYC")
    .replaceAll(/\bnys\b/g, "NYS")
    .replaceAll(/\bdoh\b/g, "DOH");
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
  if (value === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return "Routine bacteriological sample";
  if (value === "NYS_ANNUAL_CERTIFICATION")
    return "New York State annual certification";
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
  if (value === "ROUTINE_BACTERIOLOGICAL_SAMPLE")
    return "Confirm the owner-managed bacteriological culture sample";
  if (value === "NYS_ANNUAL_CERTIFICATION")
    return "Submit the New York State annual certification";
  return requirementLabel(value);
}
