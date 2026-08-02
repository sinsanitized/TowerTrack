import type { ServiceResponsibility } from "@/lib/service-responsibility";

export const sampleQueueFilters = [
  "ACTION_NEEDED",
  "WAITING",
  "COMPLETED",
  "ALL",
] as const;

export type SampleQueueFilter = (typeof sampleQueueFilters)[number];
export type SampleQueueState =
  | "RESPONSIBILITY_UNKNOWN"
  | "ACTION_NEEDED"
  | "WAITING_EXTERNAL"
  | "REFERENCE_ONLY"
  | "COMPLETED";

export type SampleQueueItem = {
  id: string;
  eventDate: string;
  responsibility: ServiceResponsibility | null;
  resultEntered: boolean;
};

export function sampleQueueState(item: SampleQueueItem): SampleQueueState {
  if (item.resultEntered) return "COMPLETED";
  if (item.responsibility == null) return "RESPONSIBILITY_UNKNOWN";
  if (item.responsibility === "OUR_COMPANY") return "ACTION_NEEDED";
  if (
    item.responsibility === "CUSTOMER" ||
    item.responsibility === "OTHER_VENDOR"
  )
    return "WAITING_EXTERNAL";
  return "REFERENCE_ONLY";
}

export function matchesSampleQueueFilter(
  item: SampleQueueItem,
  filter: SampleQueueFilter,
) {
  if (filter === "ALL") return true;
  const state = sampleQueueState(item);
  if (filter === "ACTION_NEEDED")
    return state === "ACTION_NEEDED" || state === "RESPONSIBILITY_UNKNOWN";
  if (filter === "WAITING") return state === "WAITING_EXTERNAL";
  return state === "COMPLETED";
}

export function sortSampleQueue<T extends SampleQueueItem>(items: T[]): T[] {
  const rank: Record<SampleQueueState, number> = {
    RESPONSIBILITY_UNKNOWN: 0,
    ACTION_NEEDED: 1,
    WAITING_EXTERNAL: 2,
    REFERENCE_ONLY: 3,
    COMPLETED: 4,
  };
  return [...items].sort((a, b) => {
    const aState = sampleQueueState(a);
    const bState = sampleQueueState(b);
    const stateDifference = rank[aState] - rank[bState];
    if (stateDifference) return stateDifference;
    if (aState === "COMPLETED")
      return b.eventDate.localeCompare(a.eventDate) || a.id.localeCompare(b.id);
    return a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id);
  });
}
