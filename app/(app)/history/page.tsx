import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plainEnumLabel } from "@/lib/labels";

export default async function HistoryPage() {
  const user = await requireUser();
  const events = await db.serviceEvent.findMany({
    where: {
      coolingTowerSystem: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      coolingTowerSystem: { include: { building: true } },
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="All compliance records"
        description="Records from every tower, newest first. Open a record to review its evidence, correction history, or satisfied requirement."
      />
      <ol className="panel overflow-hidden">
        {events.map((event) => (
          <li
            key={event.id}
            className={`record-row border-l-4 ${event.status === "ACTIVE" ? "border-l-emerald-600" : "border-l-slate-400"}`}
            data-testid="history-record-row"
          >
            <Link
              className="group grid gap-4 p-5 transition hover:bg-emerald-50/40 focus-visible:bg-emerald-50/40 sm:grid-cols-[170px_1fr_auto] sm:items-center"
              href={`/systems/${event.coolingTowerSystemId}/events/${event.id}`}
            >
              <ComplianceDate value={event.eventDate} compact />
              <div className="identity-block">
                <div className="font-black group-hover:text-emerald-900">
                  {plainEnumLabel(event.eventType)}
                </div>
                <div className="text-sm text-slate-600">
                  {event.coolingTowerSystem.systemName} ·{" "}
                  {event.coolingTowerSystem.building.buildingName}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <StatusBadge
                  color={event.status === "ACTIVE" ? "GREEN" : "GRAY"}
                  label={plainEnumLabel(event.status)}
                />
                <ChevronRight className="text-emerald-800" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
