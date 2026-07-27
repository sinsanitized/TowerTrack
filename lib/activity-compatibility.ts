const ANNUAL_CLEANING_ACTIVITY_TYPES = new Set([
  "ROUTINE_CLEANING",
  "STARTUP_CLEANING",
  "CLEANING",
  "CLEANING_AND_DISINFECTION",
]);

const CLEANING_EVENT_TYPES = new Set([
  "CLEANING_COMPLETED",
  "STARTUP_CLEANING_DISINFECTION",
]);

export function activitiesCanShareVisit(left: string, right: string) {
  const cleaningAndHyper =
    (ANNUAL_CLEANING_ACTIVITY_TYPES.has(left) &&
      right === "SUMMERTIME_HYPERHALOGENATION") ||
    (ANNUAL_CLEANING_ACTIVITY_TYPES.has(right) &&
      left === "SUMMERTIME_HYPERHALOGENATION");
  return !cleaningAndHyper;
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
