import { z } from "zod";
import {
  SERVICE_EVENT_TYPES,
  type ServiceEventTypeValue,
} from "@/lib/service-events";
import { parseDateTimeInTimeZone, todayInTimeZone } from "@/lib/date";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (value == null || value === "" ? null : value),
    z.string().trim().max(maximum).nullable(),
  );

const serviceEventInputSchema = z.object({
  eventType: z.enum(SERVICE_EVENT_TYPES),
  eventDate: z.string().date(),
  eventTimestamp: optionalText(64),
  cfuPerMl: z.preprocess(
    (value) => (value == null || value === "" ? null : value),
    z.coerce.number().finite().nonnegative().nullable(),
  ),
  residualOutcome: z
    .enum(["RESTORED", "NOT_RESTORED", "UNKNOWN"])
    .default("UNKNOWN"),
  reportType: optionalText(120),
  reportingObligationId: optionalText(120),
  sampleEventId: optionalText(120),
  chemical: optionalText(200),
  quantity: optionalText(200),
  contactTime: optionalText(200),
  ph: optionalText(100),
  freeHalogenResidual: optionalText(500),
  technician: optionalText(200),
  notes: optionalText(2000),
});

export type ServiceEventCommand = {
  eventType: ServiceEventTypeValue;
  eventDate: string;
  eventTimestamp: Date | null;
  details: {
    cfuPerMl: number | null;
    residualRestoredWithin3Days: boolean | null;
    reportType: string | null;
    reportingObligationId: string | null;
    sampleEventId: string | null;
    chemical: string | null;
    quantity: string | null;
    contactTime: string | null;
    ph: string | null;
    freeHalogenResidual: string | null;
    technician: string | null;
  };
  notes: string | null;
};

export function parseServiceEventCommand(
  input: Record<string, unknown>,
  options: { today?: string; now?: Date; allowFutureDate?: boolean } = {},
): ServiceEventCommand {
  const parsed = serviceEventInputSchema.parse(input);
  const today = options.today ?? todayInTimeZone();
  if (!options.allowFutureDate && parsed.eventDate > today)
    throw new Error("Completed work cannot be recorded with a future date.");

  const needsResult = [
    "LEGIONELLA_RESULT_RECEIVED",
    "WEEKLY_BIOLOGICAL_INDICATOR_RESULT",
  ].includes(parsed.eventType);
  if (needsResult && parsed.cfuPerMl == null)
    throw new Error("Enter a non-negative CFU/mL result.");

  const eventTimestamp =
    parsed.eventType === "LEGIONELLA_RESULT_RECEIVED"
      ? null
      : parsed.eventTimestamp
        ? parseDateTimeInTimeZone(parsed.eventTimestamp)
        : null;
  if (eventTimestamp && Number.isNaN(eventTimestamp.getTime()))
    throw new Error("Enter a valid result-received date and time.");
  if (
    parsed.eventType === "LEGIONELLA_RESULT_RECEIVED" &&
    !parsed.sampleEventId
  )
    throw new Error("Choose the recorded sample that produced this result.");
  if (
    eventTimestamp &&
    eventTimestamp.getTime() > (options.now ?? new Date()).getTime()
  )
    throw new Error("The result-received time cannot be in the future.");
  if (
    eventTimestamp &&
    todayInTimeZone("America/New_York", eventTimestamp) !== parsed.eventDate
  )
    throw new Error(
      "The event date must match the result-received date in New York.",
    );

  if (parsed.eventType === "REPORT_SUBMITTED" && !parsed.reportType)
    throw new Error("Choose the reporting obligation that was submitted.");

  if (
    parsed.eventType === "SUMMERTIME_HYPERHALOGENATION" &&
    ![
      parsed.chemical,
      parsed.quantity,
      parsed.contactTime,
      parsed.ph,
      parsed.freeHalogenResidual,
      parsed.technician,
    ].every(Boolean)
  )
    throw new Error(
      "Record chemical, quantity, contact time, pH, free halogen residuals, and technician.",
    );

  return {
    eventType: parsed.eventType,
    eventDate: parsed.eventDate,
    eventTimestamp,
    details: {
      cfuPerMl: parsed.cfuPerMl,
      residualRestoredWithin3Days:
        parsed.eventType !== "WEEKLY_BIOLOGICAL_INDICATOR_RESULT" ||
        parsed.residualOutcome === "UNKNOWN"
          ? null
          : parsed.residualOutcome === "RESTORED",
      reportType: parsed.reportType,
      reportingObligationId: parsed.reportingObligationId,
      sampleEventId: parsed.sampleEventId,
      chemical: parsed.chemical,
      quantity: parsed.quantity,
      contactTime: parsed.contactTime,
      ph: parsed.ph,
      freeHalogenResidual: parsed.freeHalogenResidual,
      technician: parsed.technician,
    },
    notes: parsed.notes,
  };
}

export function serviceEventInputFromFormData(formData: FormData) {
  const text = (name: string, fallback = "") =>
    String(formData.get(name) ?? fallback);
  return {
    eventType: text("eventType"),
    eventDate: text("eventDate"),
    eventTimestamp: text("eventTimestamp"),
    cfuPerMl: text("cfuPerMl"),
    residualOutcome: text("residualOutcome", "UNKNOWN"),
    reportType: text("reportType"),
    reportingObligationId: text("reportingObligationId"),
    sampleEventId: text("sampleEventId"),
    chemical: text("chemical"),
    quantity: text("quantity"),
    contactTime: text("contactTime"),
    ph: text("ph"),
    freeHalogenResidual: text("freeHalogenResidual"),
    technician: text("technician"),
    notes: text("notes"),
  };
}

const SAMPLE_ACTIVITY_TYPES = new Set([
  "ROUTINE_LEGIONELLA_SAMPLE",
  "STARTUP_LEGIONELLA_SAMPLE",
  "POST_HYPERHALOGENATION_SAMPLE",
  "CORRECTIVE_RETEST",
  "EMERGENCY_SAMPLE",
]);

export function serviceEventTypeForActivity(
  activityType: string,
  qualifiesForInspection = false,
): ServiceEventTypeValue | null {
  if (SAMPLE_ACTIVITY_TYPES.has(activityType))
    return "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED";
  if (qualifiesForInspection || activityType === "COMPLIANCE_INSPECTION")
    return "QUARTERLY_INSPECTION_COMPLETED";
  if (
    [
      "ROUTINE_CLEANING",
      "STARTUP_CLEANING",
      "CLEANING",
      "DISINFECTION",
      "CLEANING_AND_DISINFECTION",
    ].includes(activityType)
  )
    return "CLEANING_COMPLETED";
  if (activityType === "SUMMERTIME_HYPERHALOGENATION")
    return "SUMMERTIME_HYPERHALOGENATION";
  if (activityType === "CORRECTIVE_DISINFECTION")
    return "HIGH_LEGIONELLA_DISINFECTION";
  if (activityType === "FULL_REMEDIATION") return "FULL_REMEDIATION";
  if (activityType === "STARTUP") return "STARTUP";
  if (activityType === "SHUTDOWN") return "SHUTDOWN";
  return null;
}
