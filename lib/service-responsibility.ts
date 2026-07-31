export const serviceResponsibilityValues = [
  "OUR_COMPANY",
  "CUSTOMER",
  "OTHER_VENDOR",
  "NOT_TRACKED",
] as const;

export type ServiceResponsibility =
  (typeof serviceResponsibilityValues)[number];

export type ResponsibilityFilter = ServiceResponsibility | "ALL";

export function serviceResponsibilityLabel(
  value: ServiceResponsibility | null | undefined,
) {
  if (value === "OUR_COMPANY") return "Our company";
  if (value === "CUSTOMER") return "Customer managed";
  if (value === "OTHER_VENDOR") return "Managed by another vendor";
  if (value === "NOT_TRACKED") return "Reference only";
  return "Responsibility must be confirmed";
}

export function isLegionellaObligation(type: string) {
  return (
    type.includes("LEGIONELLA") ||
    (type.includes("SAMPLE") && !type.includes("BACTERIOLOGICAL")) ||
    type.includes("POST_DISINFECTION") ||
    type.includes("POST_HYPERHALOGENATION")
  );
}

export function responsibilityForObligation(
  obligationType: string,
  legionellaResponsibility: ServiceResponsibility | null | undefined,
): ServiceResponsibility | null {
  return isLegionellaObligation(obligationType)
    ? (legionellaResponsibility ?? null)
    : "OUR_COMPANY";
}

export function isOurOperationalResponsibility(
  obligationType: string,
  legionellaResponsibility: ServiceResponsibility | null | undefined,
) {
  return (
    responsibilityForObligation(obligationType, legionellaResponsibility) ===
    "OUR_COMPANY"
  );
}

export function canRecordLegionellaFieldWork(
  responsibility: ServiceResponsibility | null | undefined,
) {
  return responsibility === "OUR_COMPANY";
}

export function canRecordExternalLegionella(
  responsibility: ServiceResponsibility | null | undefined,
) {
  return responsibility === "CUSTOMER" || responsibility === "OTHER_VENDOR";
}
