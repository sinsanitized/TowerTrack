export const serviceResponsibilityValues = [
  "OUR_COMPANY",
  "CUSTOMER",
  "OTHER_VENDOR",
  "NOT_TRACKED",
] as const;

export type ServiceResponsibility =
  (typeof serviceResponsibilityValues)[number];

export type ResponsibilityFilter =
  ServiceResponsibility | "UNCONFIRMED" | "ALL";

export const serviceResponsibilityFamilies = [
  ["legionellaResponsibility", "Legionella collection"],
  ["laboratoryResultResponsibility", "Laboratory result management"],
  ["bacteriologicalResponsibility", "Bacteriological sampling"],
  ["inspectionResponsibility", "Inspection"],
  ["cleaningResponsibility", "Cleaning and disinfection"],
  ["waterTreatmentResponsibility", "Water treatment"],
  ["regulatoryReportingResponsibility", "Regulatory reporting"],
  ["certificationResponsibility", "Certification"],
] as const;

export type ServiceResponsibilityFamilyKey =
  (typeof serviceResponsibilityFamilies)[number][0];

export type TowerServiceResponsibilities = Record<
  ServiceResponsibilityFamilyKey,
  ServiceResponsibility | null
>;

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

export function responsibilityFamilyForObligation(
  obligationType: string,
  category?: string,
): ServiceResponsibilityFamilyKey {
  if (obligationType.includes("BACTERIOLOGICAL"))
    return "bacteriologicalResponsibility";
  if (category === "INSPECTION" || obligationType.includes("INSPECTION"))
    return "inspectionResponsibility";
  if (obligationType.includes("CERTIFICATION"))
    return "certificationResponsibility";
  if (obligationType.includes("CLEANING")) return "cleaningResponsibility";
  if (
    obligationType.includes("CORRECTIVE_ACTION") ||
    obligationType.includes("FULL_REMEDIATION") ||
    obligationType.includes("HYPERHALOGENATION") ||
    obligationType.includes("RESIDUAL_MONITORING")
  )
    return "waterTreatmentResponsibility";
  if (category === "REPORTING_ACTION")
    return "regulatoryReportingResponsibility";
  return "legionellaResponsibility";
}

export function responsibilityForServiceObligation(
  obligationType: string,
  category: string | undefined,
  responsibilities: Partial<TowerServiceResponsibilities>,
) {
  const family = responsibilityFamilyForObligation(obligationType, category);
  return responsibilities[family] ?? null;
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
