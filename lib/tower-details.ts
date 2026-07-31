import {
  compareUrgentAttention,
  getAttentionBucket,
  type VisitOpportunityObligation,
} from "@/lib/compliance-intelligence";

export const towerDetailViews = [
  "overview",
  "obligations",
  "history",
  "information",
  "settings",
] as const;

export type TowerDetailView = (typeof towerDetailViews)[number];

export function canViewTowerSettings(role: string) {
  return role === "ADMIN" || role === "OPERATIONS_MANAGER";
}

export function resolveTowerDetailView(
  requestedView: string | undefined,
  role: string,
): TowerDetailView {
  if (!towerDetailViews.includes(requestedView as TowerDetailView))
    return "overview";
  if (requestedView === "settings" && !canViewTowerSettings(role))
    return "overview";
  return requestedView as TowerDetailView;
}

export function selectOverviewObligations<
  T extends Pick<
    VisitOpportunityObligation,
    "id" | "latest" | "priority" | "targetStart" | "targetEnd"
  >,
>(items: T[], today: string): T[] {
  const ordered = sortTowerObligations(items, today);
  const urgent = ordered.filter(
    (item) => getAttentionBucket(item, today) === "URGENT",
  );
  const urgentIds = new Set(urgent.map((item) => item.id));
  const upcoming = ordered
    .filter((item) => !urgentIds.has(item.id))
    .slice(0, 3);

  return [...urgent, ...upcoming];
}

export function sortTowerObligations<
  T extends Pick<
    VisitOpportunityObligation,
    "id" | "latest" | "priority" | "targetStart" | "targetEnd"
  >,
>(items: T[], today: string): T[] {
  const bucketRank = { URGENT: 0, READY_NOW: 1, UPCOMING: 2 } as const;
  return [...items].sort((a, b) => {
    const aBucket = getAttentionBucket(a, today);
    const bBucket = getAttentionBucket(b, today);
    const bucketDifference = bucketRank[aBucket] - bucketRank[bBucket];
    if (bucketDifference) return bucketDifference;
    if (aBucket === "URGENT")
      return compareUrgentAttention(a, b, today) || a.id.localeCompare(b.id);
    return (
      (a.latest ?? "9999-12-31").localeCompare(b.latest ?? "9999-12-31") ||
      a.id.localeCompare(b.id)
    );
  });
}
