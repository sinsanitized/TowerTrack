import { diffDays } from "@/lib/date";

export type CoverageColor =
  "GREEN" | "YELLOW" | "RED" | "BLUE" | "GRAY" | "PURPLE";

export type CoverageRequirement = {
  id: string;
  type: string;
  sourceRule: string;
  status: string;
  color: CoverageColor;
  hardDueDate: string | null;
  preferredDate: string | null;
  earliestAllowedDate: string | null;
  schedulingWindowStart: string | null;
  latestAllowedDate: string | null;
  scheduledActivityId: string | null;
  explanation: string;
};

export type CoverageRow = {
  id: string;
  systemId: string;
  building: string;
  buildingId: string;
  systemName: string;
  jobNumber: string;
  customer: string;
  address: string;
  state: string;
  routeZone: string;
  borough: string | null;
  county: string | null;
  municipality: string | null;
  postalCode: string;
  authority: string;
  seasonal: boolean;
  seasonLabel: string;
  seasonStatus: string;
  actualStartupDate: string | null;
  actualShutdownDate: string | null;
  lastSample: string | null;
  lastCleaning: string | null;
  plannedDate: string | null;
  plannedVisitId: string | null;
  hardDueDate: string | null;
  targetDate: string | null;
  daysRemaining: number | null;
  technician: string;
  status: { color: CoverageColor; label: string; nextAction: string };
  openRequirements: CoverageRequirement[];
};

export type WorkRecommendation = {
  id: string;
  row: CoverageRow;
  date: string | null;
  color: CoverageColor;
  label: string;
  detail: string;
  activityLabels: string[];
  coveredRequirements: CoverageRequirement[];
  remainingRequirements: CoverageRequirement[];
  generatedCount: number;
  coveredCount: number;
  remainingCount: number;
  combinesMultipleObligations: boolean;
  selectable: boolean;
  why: string[];
};

const urgency: Record<CoverageColor, number> = {
  RED: 0,
  YELLOW: 1,
  PURPLE: 2,
  BLUE: 3,
  GREEN: 4,
  GRAY: 5,
};

function requirementWindow(requirement: CoverageRequirement) {
  const start =
    requirement.earliestAllowedDate ||
    requirement.schedulingWindowStart ||
    requirement.preferredDate ||
    requirement.hardDueDate;
  const end = requirement.latestAllowedDate || requirement.hardDueDate || start;
  return { start, end };
}

function dateInsideWindow(date: string, requirement: CoverageRequirement) {
  const { start, end } = requirementWindow(requirement);
  return Boolean(start && end && date >= start && date <= end);
}

export function obligationName(requirement: CoverageRequirement) {
  const text =
    `${requirement.sourceRule} ${requirement.explanation}`.toLowerCase();
  if (requirement.type === "LAB_RESULT") return "Laboratory result";
  if (requirement.type === "PORTAL_SAMPLE_DATE") return "Portal follow-up";
  if (text.includes("cleaning")) return "Post-cleaning Legionella";
  if (text.includes("startup")) return "Startup Legionella";
  if (text.includes("hyper")) return "Post-hyperhalogenation Legionella";
  if (requirement.type === "COMPLIANCE_INSPECTION")
    return "Quarterly inspection";
  if (requirement.type === "ROUTINE_LEGIONELLA_SAMPLE")
    return "Monthly Legionella";
  return requirement.type.replaceAll("_", " ").toLowerCase();
}

function activityLabelsFor(requirements: CoverageRequirement[]) {
  const labels = requirements.flatMap((requirement) => {
    const text =
      `${requirement.type} ${requirement.sourceRule} ${requirement.explanation}`.toLowerCase();
    if (
      requirement.type === "ROUTINE_LEGIONELLA_SAMPLE" ||
      text.includes("legionella") ||
      text.includes("sample")
    )
      return ["Legionella sample"];
    if (text.includes("lab")) return ["Review lab result"];
    if (text.includes("portal")) return ["Portal follow-up"];
    if (text.includes("inspection")) return ["Quarterly inspection"];
    if (text.includes("disinfection") || text.includes("hyper"))
      return ["Disinfection"];
    if (text.includes("cleaning")) return ["Cleaning"];
    return ["Review"];
  });
  return labels.filter((label, index) => labels.indexOf(label) === index);
}

function isFieldServiceRequirement(requirement: CoverageRequirement) {
  return (
    requirement.type === "ROUTINE_OPERATING_SAMPLE" ||
    requirement.type === "ROUTINE_LEGIONELLA_SAMPLE" ||
    requirement.type === "STARTUP_SAMPLE" ||
    requirement.type === "POST_HYPERHALOGENATION_SAMPLE" ||
    requirement.type === "EMERGENCY_SAMPLE" ||
    requirement.type === "BIOLOGICAL_INDICATOR_ESCALATION_SAMPLE" ||
    requirement.type.includes("RETEST") ||
    requirement.type === "COMPLIANCE_INSPECTION" ||
    requirement.type === "SUMMERTIME_HYPERHALOGENATION_DUE" ||
    requirement.type === "LEVEL_4_FULL_REMEDIATION" ||
    requirement.type.includes("CORRECTIVE_ACTION")
  );
}

function bestColor(
  requirements: CoverageRequirement[],
  fallback: CoverageColor,
) {
  return (
    requirements
      .map((requirement) => requirement.color)
      .sort((a, b) => urgency[a] - urgency[b])[0] ?? fallback
  );
}

function chooseVisitDate(
  row: CoverageRow,
  requirements: CoverageRequirement[],
): string | null {
  if (row.plannedDate) return row.plannedDate;
  const candidates = requirements
    .flatMap((requirement) => {
      const { start, end } = requirementWindow(requirement);
      return [requirement.preferredDate, start, requirement.hardDueDate, end];
    })
    .filter((date): date is string => Boolean(date))
    .filter((date, index, dates) => dates.indexOf(date) === index)
    .sort();
  let best = candidates[0] ?? row.targetDate ?? row.hardDueDate;
  let bestScore = -1;
  for (const candidate of candidates) {
    const covers = requirements.filter((requirement) =>
      dateInsideWindow(candidate, requirement),
    );
    const earliestHardDue =
      covers
        .map((requirement) => requirement.hardDueDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0] ?? candidate;
    const distanceFromDeadline = Math.abs(diffDays(candidate, earliestHardDue));
    const afterDeadlinePenalty = candidate > earliestHardDue ? 500 : 0;
    const score =
      covers.length * 1000 - distanceFromDeadline * 10 - afterDeadlinePenalty;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best ?? null;
}

function serviceRecommendations(row: CoverageRow): WorkRecommendation[] {
  const requirements = row.openRequirements
    .filter(isFieldServiceRequirement)
    .sort((a, b) =>
      (a.hardDueDate || "9999-12-31").localeCompare(
        b.hardDueDate || "9999-12-31",
      ),
    );
  const recommendations: WorkRecommendation[] = [];
  const used = new Set<string>();
  for (const requirement of requirements) {
    if (used.has(requirement.id)) continue;
    const open = requirements.filter((candidate) => !used.has(candidate.id));
    const date = chooseVisitDate(row, open);
    const covered = date
      ? open.filter((candidate) => dateInsideWindow(date, candidate))
      : [requirement];
    for (const coveredRequirement of covered) used.add(coveredRequirement.id);
    const remaining = row.openRequirements.filter(
      (candidate) =>
        !covered.some(
          (coveredRequirement) => coveredRequirement.id === candidate.id,
        ),
    );
    const color = row.plannedDate
      ? "GREEN"
      : bestColor(covered, row.status.color);
    const activityLabels = activityLabelsFor(covered);
    const combinesMultipleObligations = covered.length > 1;
    recommendations.push({
      id: `${row.id}-visit-${recommendations.length}`,
      row,
      date,
      color,
      label: row.plannedDate
        ? covered.length > 1
          ? "One completion date covers multiple requirements"
          : "Covered by planned activity"
        : color === "RED"
          ? "Complete work in this window"
          : "Recommended completion date",
      detail:
        covered.length > 1
          ? `One completion date can satisfy ${covered.length} requirements.`
          : covered[0]?.explanation || row.status.nextAction,
      activityLabels,
      coveredRequirements: covered,
      remainingRequirements: remaining,
      generatedCount: row.openRequirements.length,
      coveredCount: covered.length,
      remainingCount: remaining.length,
      combinesMultipleObligations,
      selectable:
        !row.plannedVisitId &&
        Boolean(date) &&
        ["RED", "YELLOW"].includes(color),
      why: covered
        .map((coveredRequirement) => {
          const { start, end } = requirementWindow(coveredRequirement);
          return `${obligationName(coveredRequirement)} can be fulfilled by work completed on ${date}${
            start && end ? ` inside ${start} to ${end}` : ""
          }.`;
        })
        .concat(
          combinesMultipleObligations
            ? [
                `Shared completion date: completed work can satisfy all ${covered.length} requirements.`,
              ]
            : [],
        ),
    });
  }
  return recommendations;
}

function followUpRecommendations(row: CoverageRow): WorkRecommendation[] {
  return row.openRequirements
    .filter((requirement) => !isFieldServiceRequirement(requirement))
    .map((requirement) => ({
      id: `${row.id}-${requirement.id}`,
      row,
      date: requirement.hardDueDate || requirement.preferredDate,
      color: requirement.color,
      label:
        requirement.type === "LAB_RESULT"
          ? "Waiting on laboratory"
          : requirement.type === "PORTAL_SAMPLE_DATE"
            ? "Portal follow-up"
            : "Office follow-up",
      detail: requirement.explanation,
      activityLabels:
        requirement.type === "LAB_RESULT"
          ? ["Review lab result"]
          : requirement.type === "PORTAL_SAMPLE_DATE"
            ? ["Portal follow-up"]
            : ["Office follow-up"],
      coveredRequirements: [],
      remainingRequirements: [requirement],
      generatedCount: row.openRequirements.length,
      coveredCount: 0,
      remainingCount: row.openRequirements.length,
      combinesMultipleObligations: false,
      selectable: false,
      why: [requirement.explanation],
    }));
}

export function coverageRecommendations(
  row: CoverageRow,
): WorkRecommendation[] {
  const recommendations = [
    ...serviceRecommendations(row),
    ...followUpRecommendations(row),
  ];
  if (recommendations.length) return recommendations;
  return [
    {
      id: `${row.id}-review`,
      row,
      date: row.hardDueDate,
      color: row.status.color,
      label: row.status.label,
      detail: row.status.nextAction,
      activityLabels: ["Review"],
      coveredRequirements: [],
      remainingRequirements: row.openRequirements,
      generatedCount: row.openRequirements.length,
      coveredCount: 0,
      remainingCount: row.openRequirements.length,
      combinesMultipleObligations: false,
      selectable: false,
      why: [row.status.nextAction],
    },
  ];
}
