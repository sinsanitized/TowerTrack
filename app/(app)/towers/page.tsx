import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { complianceDashboardRows } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatLegionellaResult, requiredActionLabel } from "@/lib/labels";
import { todayDateOnly } from "@/lib/date";

export default async function TowersPage() {
  const user = await requireUser();
  const today = todayDateOnly();
  const [rows, results] = await Promise.all([
    complianceDashboardRows({ organizationId: user.organizationId, today }),
    db.labResult.findMany({
      where: {
        coolingTowerSystem: {
          building: { customer: { organizationId: user.organizationId } },
        },
      },
      orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
      select: { coolingTowerSystemId: true, cfuPerMl: true },
    }),
  ]);
  const latestResult = new Map<string, number>();
  for (const result of results)
    if (!latestResult.has(result.coolingTowerSystemId))
      latestResult.set(result.coolingTowerSystemId, result.cfuPerMl);
  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Towers"
        description="Current condition, next action, deadline, and unresolved issues for every cooling tower."
      />
      <div className="panel overflow-hidden">
        <div className="hidden grid-cols-[1.1fr_.7fr_1.2fr_.8fr_.7fr_.35fr_auto] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500 lg:grid">
          <div>Tower</div>
          <div>Status</div>
          <div>Next required action</div>
          <div>Deadline</div>
          <div>Latest result</div>
          <div>Issues</div>
          <span />
        </div>
        {rows.map((row) => {
          const next = row.openObligations.find(
            (item) =>
              ![
                "MISSED",
                "OVERDUE",
                "COMPLETED",
                "CANCELED",
                "SUPERSEDED",
              ].includes(item.status),
          );
          const issues = row.openObligations.filter((item) =>
            ["MISSED", "OVERDUE"].includes(item.status),
          ).length;
          return (
            <article
              key={row.id}
              className="grid gap-3 border-b p-5 last:border-b-0 lg:grid-cols-[1.1fr_.7fr_1.2fr_.8fr_.7fr_.35fr_auto] lg:items-center"
            >
              <div>
                <div className="font-black">{row.systemName}</div>
                <div className="text-sm text-slate-600">
                  {row.building} · {row.customer}
                </div>
              </div>
              <StatusBadge
                color={row.complianceHealth.color}
                label={row.complianceHealth.label}
              />
              <div>
                <div className="label lg:hidden">Next required action</div>
                <div className="font-bold">
                  {next
                    ? requiredActionLabel(next.type)
                    : "No actionable obligation"}
                </div>
              </div>
              <ComplianceDate
                value={next?.latest}
                label="Deadline"
                compact
                operational
              />
              <div>
                <div className="label lg:hidden">Most recent result</div>
                <div className="font-bold">
                  {latestResult.has(row.id)
                    ? formatLegionellaResult(latestResult.get(row.id))
                    : "No result entered"}
                </div>
              </div>
              <div
                className={
                  issues
                    ? "font-black text-red-800"
                    : "font-bold text-slate-600"
                }
              >
                <span className="lg:hidden">Unresolved issues: </span>
                {issues}
              </div>
              <Link
                className="btn min-h-11 justify-center"
                href={`/systems/${row.id}`}
              >
                Open workspace
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
