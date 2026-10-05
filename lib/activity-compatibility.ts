const ANNUAL_CLEANING_ACTIVITY_TYPES = new Set([
  "ROUTINE_CLEANING",
  "STARTUP_CLEANING",
  "CLEANING",
  "CLEANING_AND_DISINFECTION",
]);

const CLEANING_VISIT_ACTIVITY_TYPES = new Set([
  ...ANNUAL_CLEANING_ACTIVITY_TYPES,
  "FULL_REMEDIATION",
]);

const LEGIONELLA_SAMPLE_ACTIVITY_TYPES = new Set([
  "ROUTINE_LEGIONELLA_SAMPLE",
  "STARTUP_LEGIONELLA_SAMPLE",
  "POST_HYPERHALOGENATION_SAMPLE",
  "EMERGENCY_SAMPLE",
  "CORRECTIVE_RETEST",
]);

const CLEANING_EVENT_TYPES = new Set([
  "CLEANING_COMPLETED",
  "STARTUP_CLEANING_DISINFECTION",
]);

const ANNUAL_CLEANING_COMPLETION_EVENT_TYPES = new Set([
  ...CLEANING_EVENT_TYPES,
  "FULL_REMEDIATION",
]);

export function activitiesCanShareVisit(left: string, right: string) {
  const cleaningAndHyper =
    (ANNUAL_CLEANING_ACTIVITY_TYPES.has(left) &&
      right === "SUMMERTIME_HYPERHALOGENATION") ||
    (ANNUAL_CLEANING_ACTIVITY_TYPES.has(right) &&
      left === "SUMMERTIME_HYPERHALOGENATION");
  const cleaningAndLegionellaSample =
    (CLEANING_VISIT_ACTIVITY_TYPES.has(left) &&
      LEGIONELLA_SAMPLE_ACTIVITY_TYPES.has(right)) ||
    (CLEANING_VISIT_ACTIVITY_TYPES.has(right) &&
      LEGIONELLA_SAMPLE_ACTIVITY_TYPES.has(left));
  return !cleaningAndHyper && !cleaningAndLegionellaSample;
}

export function completedEventsConflictOnSameDate(left: string, right: string) {
  return (
    (CLEANING_EVENT_TYPES.has(left) &&
      right === "SUMMERTIME_HYPERHALOGENATION") ||
    (CLEANING_EVENT_TYPES.has(right) && left === "SUMMERTIME_HYPERHALOGENATION")
  );
}

export function isAnnualCleaningActivity(activityType: string) {
  return ANNUAL_CLEANING_ACTIVITY_TYPES.has(activityType);
}

export function isCleaningCompletionEvent(eventType: string) {
  return CLEANING_EVENT_TYPES.has(eventType);
}

export function annualCleaningCompletionDates(
  events: Array<{ eventType: string; eventDate: string | Date }>,
) {
  return events
    .filter((event) =>
      ANNUAL_CLEANING_COMPLETION_EVENT_TYPES.has(event.eventType),
    )
    .map((event) => event.eventDate);
}
