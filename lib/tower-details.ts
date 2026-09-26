import {
  compareUrgentAttention,
  getAttentionBucket,
  type VisitOpportunityObligation,
} from "@/lib/compliance-intelligence";
import { workingDaysRemaining } from "@/lib/date";

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

export type NextTowerActionState =
  | "OVERDUE"
  | "DUE_SOON"
  | "REVIEW_REQUIRED"
  | "UPCOMING_TARGET"
  | "UPCOMING_DEADLINE"
  | "NONE";

export type NextTowerActionSelection<T> = {
  state: NextTowerActionState;
  items: T[];
  controllingDate: string | null;
  workingDaysLeft: number | null;
  reason: string;
  immediate: boolean;
};

type NextActionObligation = Pick<
  VisitOpportunityObligation,
  "id" | "status" | "latest" | "targetStart" | "priority"
>;

function obligationPriorityRank(priority: string) {
  if (priority === "EMERGENCY") return 0;
  if (priority === "CRITICAL") return 1;
  if (priority === "WARNING") return 2;
  return 3;
}

function nextActionRank(item: NextActionObligation, today: string) {
  const overdue =
    item.status === "MISSED" ||
    item.status === "OVERDUE" ||
    (item.latest != null && item.latest < today);
  if (overdue) return { rank: 0, state: "OVERDUE" as const, date: item.latest };
  if (item.latest) {
    const workingDays = workingDaysRemaining(item.latest, today);
    if (workingDays >= 0 && workingDays <= 3)
      return { rank: 1, state: "DUE_SOON" as const, date: item.latest };
  }
  if (!item.latest)
    return {
      rank: 2,
      state: "REVIEW_REQUIRED" as const,
      date: null,
    };
  if (item.targetStart)
    return {
      rank: 3,
      state: "UPCOMING_TARGET" as const,
      date: item.targetStart,
    };
  return {
    rank: 4,
    state: "UPCOMING_DEADLINE" as const,
    date: item.latest,
  };
}

const nextActionReasons: Record<
  Exclude<NextTowerActionState, "NONE">,
  string
> = {
  OVERDUE: "Its hard deadline has passed and it requires immediate review.",
  DUE_SOON: "Its hard deadline is within the next three working days.",
  REVIEW_REQUIRED:
    "Missing information prevents TowerTrack from calculating its deadline.",
  UPCOMING_TARGET: "It has the earliest upcoming target date.",
  UPCOMING_DEADLINE: "It has the earliest upcoming hard deadline.",
};

export function selectNextTowerActions<T extends NextActionObligation>(
  items: T[],
  today: string,
): NextTowerActionSelection<T> {
  const active = items.filter(
    (item) => !["COMPLETED", "CANCELLED"].includes(item.status),
  );
  if (!active.length)
    return {
      state: "NONE",
      items: [],
      controllingDate: null,
      workingDaysLeft: null,
      reason: "No active compliance requirement currently needs attention.",
      immediate: false,
    };

  const ranked = active
    .map((item) => ({
      item,
      priority: nextActionRank(item, today),
      obligationPriority: obligationPriorityRank(item.priority),
    }))
    .sort(
      (a, b) =>
        a.priority.rank - b.priority.rank ||
        (a.priority.date ?? "0000-00-00").localeCompare(
          b.priority.date ?? "0000-00-00",
        ) ||
        a.obligationPriority - b.obligationPriority ||
        a.item.id.localeCompare(b.item.id),
    );
  const selectedPriority = ranked[0].priority;
  const selectedObligationPriority = ranked[0].obligationPriority;
  const selected = ranked
    .filter(
      ({ priority, obligationPriority }) =>
        priority.rank === selectedPriority.rank &&
        priority.date === selectedPriority.date &&
        obligationPriority === selectedObligationPriority,
    )
    .map(({ item }) => item);
  const state = selectedPriority.state;
  return {
    state,
    items: selected,
    controllingDate: selectedPriority.date,
    workingDaysLeft: selected[0]?.latest
      ? workingDaysRemaining(selected[0].latest!, today)
      : null,
    reason: nextActionReasons[state],
    immediate: ["OVERDUE", "DUE_SOON", "REVIEW_REQUIRED"].includes(state),
  };
}
