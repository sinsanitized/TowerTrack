import type { RegulatoryEventType } from "@/lib/obligation-engine";

export const eventEntryIntentNames = [
  "sample",
  "resample",
  "result",
  "inspection",
  "cleaning",
  "startup-cleaning",
  "disinfection",
  "remediation",
  "hyperhalogenation",
  "startup",
  "shutdown",
  "biological",
  "bacteriological",
  "external-legionella",
] as const;

export type EventEntryIntentName = (typeof eventEntryIntentNames)[number];

export type EventEntryIntent = {
  type: EventEntryIntentName;
  towerId: string;
  obligationId?: string;
  triggerEventId?: string;
  sampleEventId?: string;
  returnTo?: string;
};

const eventTypeByIntent: Partial<
  Record<EventEntryIntentName, RegulatoryEventType>
> = {
  sample: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
  resample: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
  inspection: "QUARTERLY_INSPECTION_COMPLETED",
  cleaning: "CLEANING_COMPLETED",
  "startup-cleaning": "STARTUP_CLEANING_DISINFECTION",
  disinfection: "HIGH_LEGIONELLA_DISINFECTION",
  remediation: "FULL_REMEDIATION",
  hyperhalogenation: "SUMMERTIME_HYPERHALOGENATION",
  startup: "STARTUP",
  shutdown: "SHUTDOWN",
  biological: "WEEKLY_BIOLOGICAL_INDICATOR_RESULT",
  bacteriological: "BACTERIOLOGICAL_SAMPLE_COLLECTED",
  "external-legionella": "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
};

export function eventTypeForEntryIntent(type: EventEntryIntentName) {
  return eventTypeByIntent[type];
}

export function parseEventEntryIntent(
  towerId: string,
  query: Record<string, string | string[] | undefined>,
): EventEntryIntent | null {
  const record = typeof query.record === "string" ? query.record : null;
  if (
    !record ||
    !eventEntryIntentNames.includes(record as EventEntryIntentName)
  )
    return null;
  const safeReturnTo =
    typeof query.returnTo === "string" &&
    query.returnTo.startsWith("/") &&
    !query.returnTo.startsWith("//")
      ? query.returnTo
      : undefined;
  return {
    type: record as EventEntryIntentName,
    towerId,
    obligationId:
      typeof query.obligation === "string" ? query.obligation : undefined,
    triggerEventId:
      typeof query.trigger === "string" ? query.trigger : undefined,
    sampleEventId: typeof query.sample === "string" ? query.sample : undefined,
    returnTo: safeReturnTo,
  };
}

export function eventEntryHref(intent: EventEntryIntent) {
  const params = new URLSearchParams({ record: intent.type });
  if (intent.obligationId) params.set("obligation", intent.obligationId);
  if (intent.triggerEventId) params.set("trigger", intent.triggerEventId);
  if (intent.sampleEventId) params.set("sample", intent.sampleEventId);
  if (intent.returnTo) params.set("returnTo", intent.returnTo);
  return `/systems/${intent.towerId}?${params.toString()}#record-event`;
}

export function isResampleObligation(type: string) {
  return (
    type.includes("RETEST") ||
    type.includes("POST_") ||
    type === "EMERGENCY_SAMPLE" ||
    type === "BIOLOGICAL_INDICATOR_ESCALATION_SAMPLE"
  );
}
