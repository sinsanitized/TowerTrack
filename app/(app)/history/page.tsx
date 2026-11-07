import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plainEnumLabel } from "@/lib/labels";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const pageSize = 15;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const where = {
    coolingTowerSystem: {
      building: { customer: { organizationId: user.organizationId } },
    },
  };
  const eventCount = await db.serviceEvent.count({ where });
  const pageCount = Math.max(1, Math.ceil(eventCount / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1;
  const events = await db.serviceEvent.findMany({
    where,
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      coolingTowerSystem: { include: { building: true } },
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="Records"
        description="Completed work from every tower, newest first."
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
        {pageCount > 1 && (
          <li>
            <nav
              className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4"
              aria-label="Compliance record pages"
            >
              {page > 1 ? (
                <Link
                  className="btn"
                  href={page === 2 ? "/history" : `/history?page=${page - 1}`}
                >
                  ← Previous {pageSize}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm font-bold text-slate-700">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link className="btn" href={`/history?page=${page + 1}`}>
                  Next {pageSize} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </li>
        )}
      </ol>
    </>
  );
}
