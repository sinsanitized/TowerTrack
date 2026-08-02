import type { RegulatoryEventType } from "@/lib/obligation-engine";

export type EventWorkflowClassification =
  | "FREQUENT_FIELD"
  | "INFREQUENT_FIELD"
  | "OFFICE_ADMINISTRATIVE"
  | "OWNER_MANAGED"
  | "EXTERNAL_PROVIDER"
  | "SYSTEM_GENERATED";

export type EventWorkflowDefinition = {
  type: RegulatoryEventType;
  label: string;
  classification: EventWorkflowClassification;
  location: "PRIMARY" | "MORE" | "OFFICE_ONLY" | "NOT_IN_MENU";
};

export const eventWorkflowDefinitions: readonly EventWorkflowDefinition[] = [
  {
    type: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
    label: "Sample",
    classification: "FREQUENT_FIELD",
    location: "PRIMARY",
  },
  {
    type: "LEGIONELLA_RESULT_RECEIVED",
    label: "Laboratory result",
    classification: "OFFICE_ADMINISTRATIVE",
    location: "PRIMARY",
  },
  {
    type: "QUARTERLY_INSPECTION_COMPLETED",
    label: "Inspection",
    classification: "FREQUENT_FIELD",
    location: "PRIMARY",
  },
  {
    type: "HIGH_LEGIONELLA_DISINFECTION",
    label: "Disinfection",
    classification: "FREQUENT_FIELD",
    location: "PRIMARY",
  },
  {
    type: "CLEANING_COMPLETED",
    label: "Cleaning",
    classification: "INFREQUENT_FIELD",
    location: "PRIMARY",
  },
  {
    type: "SUMMERTIME_HYPERHALOGENATION",
    label: "Record hyperhalogenation",
    classification: "INFREQUENT_FIELD",
    location: "MORE",
  },
  {
    type: "STARTUP",
    label: "Record startup",
    classification: "INFREQUENT_FIELD",
    location: "MORE",
  },
  {
    type: "SHUTDOWN",
    label: "Record shutdown",
    classification: "INFREQUENT_FIELD",
    location: "MORE",
  },
  {
    type: "POWER_FAILURE",
    label: "Record emergency condition",
    classification: "INFREQUENT_FIELD",
    location: "MORE",
  },
  {
    type: "WEEKLY_BIOLOGICAL_INDICATOR_RESULT",
    label: "Record biological indicator result",
    classification: "INFREQUENT_FIELD",
    location: "MORE",
  },
  {
    type: "BACTERIOLOGICAL_SAMPLE_COLLECTED",
    label: "Confirm owner-managed bacteriological sample",
    classification: "OWNER_MANAGED",
    location: "OFFICE_ONLY",
  },
  {
    type: "REPORT_SUBMITTED",
    label: "Record certification or report",
    classification: "OFFICE_ADMINISTRATIVE",
    location: "NOT_IN_MENU",
  },
];

export function eventDefinitionsForLocation(
  location: EventWorkflowDefinition["location"],
) {
  return eventWorkflowDefinitions.filter((item) => item.location === location);
}

export function isOwnerManagedObligation(type: string) {
  return type === "ROUTINE_BACTERIOLOGICAL_SAMPLE";
}

export function isOfficeOnlyEvent(type: string) {
  return type === "BACTERIOLOGICAL_SAMPLE_COLLECTED";
}
