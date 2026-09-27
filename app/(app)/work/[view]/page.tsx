import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Layers3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { ObligationIntelligenceCard } from "@/components/obligation-intelligence-card";
import { StatusBadge } from "@/components/status-badge";
import { ClickableRow } from "@/components/clickable-row";
import { todayDateOnly } from "@/lib/date";
import { plainEnumLabel } from "@/lib/labels";
import { complianceDashboardRows } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { responsibilityForServiceObligation } from "@/lib/service-responsibility";

const views = {
  "overdue-towers": {
    title: "Compliance issues",
    description:
      "Missed and overdue requirements are historical compliance issues, not tasks that can still be completed on time.",
    empty: "No active towers currently have a missed or overdue requirement.",
    unit: "issues",
    Icon: AlertTriangle,
  },
  "visit-opportunities": {
    title: "Work that can be completed together",
    description:
      "Shared valid dates when one set of completed field work can satisfy multiple requirements.",
    empty:
      "No on-site requirement currently has dates when the required work can still be completed.",
    unit: "compatible work groups",
    Icon: Layers3,
  },
} as const;

type View = keyof typeof views;
type DashboardRows = Awaited<ReturnType<typeof complianceDashboardRows>>;
type DashboardRow = DashboardRows[number];

function relevantObligations(row: DashboardRow, view: View) {
  if (view === "overdue-towers")
    return row.openObligations.filter(
      (item) =>
        (item.status === "MISSED" || item.status === "OVERDUE") &&
        ["OUR_COMPANY", null].includes(
          responsibilityForServiceObligation(item.type, item.category, row),
        ),
    );
  if (view === "visit-opportunities")
    return row.openObligations.filter(
      (item) =>
        row.visitOpportunity?.obligations.some(
          (opportunityItem) => opportunityItem.id === item.id,
        ) ?? false,
    );
  return [];
}

export default async function WorkViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view: requestedView } = await params;
  if (requestedView === "emergency-samples") redirect("/");
  if (requestedView === "open-obligations") redirect("/deadlines");
  if (!(requestedView in views)) notFound();
  const view = requestedView as View;
  const config = views[view];
  const today = todayDateOnly();
  const user = await requireUser();
  const rows = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
  });
  const groups = rows
    .map((row) => ({
      row,
      obligations: relevantObligations(row, view).sort((a, b) =>
        (a.latest ?? "0000-00-00").localeCompare(b.latest ?? "0000-00-00"),
      ),
    }))
    .filter(({ row, obligations }) =>
      view === "visit-opportunities"
        ? Boolean(row.visitOpportunity) && obligations.length > 0
        : obligations.length > 0,
    );
  const count =
    view === "overdue-towers"
      ? groups.reduce((sum, group) => sum + group.obligations.length, 0)
      : groups.length;
  const Icon = config.Icon;

  return (
    <>
      <PageHeader
        eyebrow="Tower work details"
        title={config.title}
        description={config.description}
        actions={
          <Link className="btn" href="/">
            <ArrowLeft size={17} /> Back to Action Center
          </Link>
        }
      />

      <div className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-600">
        <Icon size={18} />
        <span>
          {count} {config.unit} in this view
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="panel p-8 text-center">
          <h2 className="text-lg font-black">Nothing in this category</h2>
          <p className="mt-2 text-slate-600">{config.empty}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ row, obligations }) => (
            <article key={row.id} className="panel overflow-hidden">
              <ClickableRow
                href={
                  view === "overdue-towers"
                    ? `/systems/${row.id}#compliance-history`
                    : `/systems/${row.id}#record-event`
                }
                label={`${view === "overdue-towers" ? "Review history" : "Open tower"}: ${row.systemName}`}
                className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start"
              >
                <div>
                  <StatusBadge
                    color={row.complianceHealth.color}
                    label={row.complianceHealth.label}
                  />
                  <h2 className="mt-3 text-lg font-black">
                    {row.building} — {row.systemName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {row.customer} · {row.address}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {row.routeZone} · {plainEnumLabel(row.operatingStatus)} ·{" "}
                    {row.profile}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="btn btn-primary"
                    href={
                      view === "overdue-towers"
                        ? `/systems/${row.id}#compliance-history`
                        : `/systems/${row.id}#record-event`
                    }
                  >
                    {view === "overdue-towers"
                      ? "Review history"
                      : "Open tower"}
                  </Link>
                </div>
              </ClickableRow>
              {view === "visit-opportunities" && row.visitOpportunity && (
                <div className="mx-5 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <div className="label">Shared valid completion dates</div>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <ComplianceWindow
                      start={row.visitOpportunity.start}
                      end={row.visitOpportunity.end}
                      label="Dates when all listed actions can be completed"
                    />
                    <ComplianceDate
                      value={row.visitOpportunity.controllingDeadline}
                      label="Deadline"
                      deadline
                    />
                  </div>
                  <p className="mt-3 text-sm font-bold">
                    {row.visitOpportunity.explanation}
                  </p>
                  <p className="mt-2 text-sm font-black">
                    {row.visitOpportunity.obligations.length > 1
                      ? `Completed work on one valid date can satisfy ${row.visitOpportunity.obligations.length} requirements.`
                      : "Only one field requirement can be completed within this date window."}
                  </p>
                  <div className="mt-4 border-t border-emerald-200 pt-3">
                    <p className="text-sm font-bold">
                      These dates are guidance, not an appointment. After the
                      work happens, record its actual completion date from the
                      tower.
                    </p>
                    <Link
                      className="btn btn-primary mt-3"
                      href={`/systems/${row.id}#record-event`}
                    >
                      Record completed work
                    </Link>
                  </div>
                </div>
              )}
              <div className="px-5 pb-2">
                {obligations.map((item) => (
                  <ObligationIntelligenceCard
                    key={item.id}
                    obligation={item}
                    today={today}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
