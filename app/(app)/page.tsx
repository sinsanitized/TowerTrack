import Link from "next/link";
import { AlertTriangle, CalendarCheck, Layers3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import {
  compareUrgentAttention,
  getAttentionBucket,
  getUrgency,
} from "@/lib/compliance-intelligence";
import { complianceDashboardRows } from "@/lib/queries";
import { requirementLabel, requiredActionLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import { todayDateOnly } from "@/lib/date";

type DashboardRows = Awaited<ReturnType<typeof complianceDashboardRows>>;
type DashboardRow = DashboardRows[number];
type DashboardObligation = DashboardRow["openObligations"][number];

function ActionRow({
  row,
  obligation,
  today,
}: {
  row: DashboardRow;
  obligation: DashboardObligation;
  today: string;
}) {
  const urgency = getUrgency({
    today,
    status: obligation.status,
    priority: obligation.priority,
    latestDueDate: obligation.latest,
    targetStartDate: obligation.targetStart,
  });
  return (
    <article className="border-b border-slate-200 p-4 last:border-b-0 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(170px,.65fr)_minmax(260px,1.2fr)_minmax(190px,.75fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="font-black">{row.systemName}</div>
          <div className="text-sm text-slate-600">{row.building}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Required action
          </div>
          <h3 className="mt-1 text-lg font-black">
            {requiredActionLabel(obligation.type)}
          </h3>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-bold text-emerald-800">
              Why this is required
            </summary>
            <p className="mt-2 text-slate-600">{obligation.reason}</p>
          </details>
        </div>
        <div>
          <ComplianceDate
            value={obligation.latest}
            label="Deadline"
            deadline
            operational
            empty={obligation.priority === "EMERGENCY" ? "Immediate" : "Open"}
          />
          <div className="mt-2">
            <StatusBadge color={urgency.color} label={urgency.label} />
          </div>
        </div>
        <Link
          className="btn btn-primary min-h-11 justify-center whitespace-nowrap"
          href={`/systems/${row.id}${
            obligation.category === "SAMPLE" ? "?record=sample" : ""
          }#record-event`}
        >
          {obligation.category === "SAMPLE" ? "Record sample" : "Open tower"}
        </Link>
      </div>
    </article>
  );
}

export default async function ActionCenterPage() {
  const user = await requireUser();
  const today = todayDateOnly();
  const rows = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
  });
  const actionable = rows.flatMap((row) =>
    row.openObligations
      .filter(
        (obligation) =>
          ![
            "MISSED",
            "OVERDUE",
            "COMPLETED",
            "CANCELED",
            "SUPERSEDED",
          ].includes(obligation.status),
      )
      .map((obligation) => ({ row, obligation })),
  );
  const dueItems = actionable
    .filter(
      ({ obligation }) => getAttentionBucket(obligation, today) === "URGENT",
    )
    .sort((a, b) => compareUrgentAttention(a.obligation, b.obligation, today));
  const dueIds = new Set(dueItems.map(({ obligation }) => obligation.id));
  const combinedRows = rows.filter(
    (row) =>
      (row.visitOpportunity?.obligations.length ?? 0) > 1 &&
      row.visitOpportunity!.obligations.every((item) => !dueIds.has(item.id)),
  );
  const combinedIds = new Set(
    combinedRows.flatMap((row) =>
      row.visitOpportunity!.obligations.map((item) => item.id),
    ),
  );
  const upcomingItems = actionable
    .filter(
      ({ obligation }) =>
        !dueIds.has(obligation.id) && !combinedIds.has(obligation.id),
    )
    .sort((a, b) =>
      (a.obligation.latest ?? "9999-12-31").localeCompare(
        b.obligation.latest ?? "9999-12-31",
      ),
    );
  const issueCount = rows.reduce(
    (count, row) =>
      count +
      row.openObligations.filter((obligation) =>
        ["MISSED", "OVERDUE"].includes(obligation.status),
      ).length,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Daily operations"
        title="Action Center"
        description="Work that can still prevent a compliance failure, ordered by deadline."
      />

      {issueCount > 0 && (
        <section className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={20} />
            <div>
              <div className="label text-red-800">Compliance issues</div>
              <h2 className="mt-1 text-lg font-black">
                {issueCount} unresolved {issueCount === 1 ? "issue" : "issues"}
              </h2>
              <p className="mt-1 text-sm">
                These need review and are kept separate from preventable work.
              </p>
            </div>
          </div>
          <Link
            className="btn min-h-11 border-red-300 bg-white"
            href="/work/overdue-towers"
          >
            Review compliance issues
          </Link>
        </section>
      )}

      <section className="panel mb-7 overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <div className="label">Highest priority</div>
          <h2 className="mt-1 text-xl font-black">
            Due within the next three working days
          </h2>
        </div>
        {dueItems.length ? (
          dueItems.map(({ row, obligation }) => (
            <ActionRow
              key={obligation.id}
              row={row}
              obligation={obligation}
              today={today}
            />
          ))
        ) : (
          <p className="p-5 text-sm font-bold text-slate-600">
            Nothing is due within the next three working days.
          </p>
        )}
      </section>

      <section className="panel mb-7 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Layers3 className="mt-1" size={20} />
            <div>
              <div className="label">Route optimization</div>
              <h2 className="mt-1 text-xl font-black">
                Recommended combined visits
              </h2>
            </div>
          </div>
          <Link
            className="text-sm font-black text-emerald-800"
            href="/work/visit-opportunities"
          >
            View all recommendations →
          </Link>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {combinedRows.length ? (
            combinedRows.map((row) => {
              const opportunity = row.visitOpportunity!;
              return (
                <article
                  key={row.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="font-black">{row.systemName}</div>
                  <div className="text-sm text-emerald-950">{row.building}</div>
                  <h3 className="mt-3 text-lg font-black">
                    One visit can satisfy {opportunity.obligations.length}{" "}
                    obligations
                  </h3>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {opportunity.obligations.map((item) => (
                      <li key={item.id}>{requirementLabel(item.type)}</li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ComplianceWindow
                      start={opportunity.start}
                      end={opportunity.end}
                      label="Recommended combined service dates"
                      compact
                    />
                    <ComplianceDate
                      value={opportunity.controllingDeadline}
                      label="Deadline"
                      deadline
                      operational
                    />
                  </div>
                  <Link
                    className="btn btn-primary mt-4 min-h-11"
                    href={`/systems/${row.id}#record-event`}
                  >
                    Open tower and record work
                  </Link>
                </article>
              );
            })
          ) : (
            <p className="text-sm font-bold text-slate-600">
              No non-urgent obligations currently share valid completion dates.
            </p>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5">
          <CalendarCheck size={20} />
          <div>
            <div className="label">Plan ahead</div>
            <h2 className="mt-1 text-xl font-black">
              Upcoming and currently actionable
            </h2>
          </div>
        </div>
        {upcomingItems.length ? (
          upcomingItems.map(({ row, obligation }) => (
            <ActionRow
              key={obligation.id}
              row={row}
              obligation={obligation}
              today={today}
            />
          ))
        ) : (
          <p className="p-5 text-sm text-slate-600">
            No additional actionable obligations are open.
          </p>
        )}
      </section>
    </>
  );
}
