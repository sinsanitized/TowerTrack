import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { complianceDashboardRows } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { requiredActionLabel } from "@/lib/labels";
import { todayDateOnly } from "@/lib/date";

export default async function TowersPage() {
  const user = await requireUser();
  const today = todayDateOnly();
  const rows = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
  });
  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Towers"
        description="Current condition, next action, deadline, and unresolved issues for every cooling tower."
      />
      <div className="panel overflow-hidden">
        <div className="hidden grid-cols-[1.1fr_.7fr_1.2fr_.8fr_.35fr_auto] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500 lg:grid">
          <div>Tower</div>
          <div>Status</div>
          <div>Next required action</div>
          <div>Deadline</div>
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
              className={`record-row grid gap-4 border-l-4 p-5 lg:grid-cols-[1.1fr_.7fr_1.2fr_.8fr_.35fr_auto] lg:items-center ${issues ? "urgency-red" : row.complianceHealth.color === "YELLOW" ? "urgency-amber" : "border-l-slate-300"}`}
            >
              <div className="identity-block">
                <Link
                  className="font-black text-emerald-900 underline decoration-emerald-300 underline-offset-2"
                  href={`/systems/${row.id}`}
                >
                  {row.systemName}
                </Link>
                <div className="text-sm text-slate-600">
                  {row.building} · {row.customer}
                </div>
                <div className="mt-1 text-sm text-slate-600">{row.address}</div>
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
                    : "No actionable requirement"}
                </div>
              </div>
              <ComplianceDate
                value={next?.latest}
                label="Deadline"
                compact
                operational
              />
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
                className="btn btn-ghost min-h-11 justify-center"
                href={`/systems/${row.id}`}
              >
                Open tower
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
