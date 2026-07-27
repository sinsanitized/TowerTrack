import Link from "next/link";
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
        title="Compliance History"
        description="Chronological regulatory events, corrections, and preserved historical records."
      />
      <ol className="panel divide-y divide-slate-200">
        {events.map((event) => (
          <li
            key={event.id}
            className="grid gap-3 p-5 sm:grid-cols-[150px_1fr_auto] sm:items-center"
          >
            <ComplianceDate value={event.eventDate} compact />
            <div>
              <div className="font-black">
                {plainEnumLabel(event.eventType)}
              </div>
              <div className="text-sm text-slate-600">
                {event.coolingTowerSystem.systemName} ·{" "}
                {event.coolingTowerSystem.building.buildingName}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge
                color={event.status === "ACTIVE" ? "GREEN" : "GRAY"}
                label={plainEnumLabel(event.status)}
              />
              <Link
                className="font-bold text-emerald-800"
                href={`/systems/${event.coolingTowerSystemId}/events/${event.id}`}
              >
                Review →
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
