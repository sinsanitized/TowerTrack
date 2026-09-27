import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { db } from "@/lib/db";
import { dateOnly, formatDate } from "@/lib/date";
import { plainEnumLabel } from "@/lib/labels";
import { requireUser } from "@/lib/auth";

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const visit = await db.visit.findFirst({
    where: {
      id,
      building: { customer: { organizationId: user.organizationId } },
    },
    include: {
      building: true,
      activities: {
        orderBy: { createdAt: "asc" },
        include: { coolingTowerSystem: true },
      },
    },
  });
  if (!visit) notFound();

  const cleaningPlanActivity = visit.activities.find((activity) => {
    const details = activity.details as { planType?: unknown } | null;
    return details?.planType === "TWO_DAY_ANNUAL_CLEANING";
  });
  const cleaningPlanDetails = cleaningPlanActivity?.details as {
    chemicalAddDate?: string;
    cleaningDate?: string;
  } | null;

  return (
    <>
      <PageHeader
        eyebrow="Legacy planning record"
        title={visit.building.buildingName}
        description={`${formatDate(visit.scheduledDate)} · ${visit.building.streetAddress}`}
      />
      <div className="mb-6 flex gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-900">
        <Archive className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-black">This record is read-only</div>
          <p className="mt-1 text-sm">
            TowerTrack no longer schedules visits. A planned date does not
            satisfy a requirement. Open the tower below and record the date the
            work actually happened.
          </p>
        </div>
      </div>

      {cleaningPlanActivity && (
        <section className="panel mb-6 p-5">
          <div className="label">Saved planning reference</div>
          <h2 className="mt-1 text-xl font-black">
            Former cleaning plan dates
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ComplianceDate
              value={cleaningPlanDetails?.chemicalAddDate}
              label="Planned chemical addition"
              operational
            />
            <ComplianceDate
              value={cleaningPlanDetails?.cleaningDate ?? visit.scheduledDate}
              label="Planned physical cleaning"
              operational
            />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-700">
            These dates are historical planning information only. They did not
            close the annual cleaning requirement.
          </p>
        </section>
      )}

      <section className="panel p-5">
        <div className="label">Actual work</div>
        <h2 className="mt-1 text-xl font-black">Record completion by tower</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose a tower to review its open requirements and enter the actual
          completion date.
        </p>
        <div className="mt-4 space-y-3">
          {visit.activities.map((activity) => (
            <Link
              key={activity.id}
              href={`/systems/${activity.coolingTowerSystemId}?view=obligations#record-event`}
              className="group block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black group-hover:text-emerald-950">
                    {activity.coolingTowerSystem.systemName}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {plainEnumLabel(activity.activityType)} · Planned for{" "}
                    {formatDate(dateOnly(activity.scheduledDate))}
                  </div>
                </div>
                <span className="btn">Record actual work</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
