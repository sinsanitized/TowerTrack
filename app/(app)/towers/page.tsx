import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { ClickableRow } from "@/components/clickable-row";
import { complianceDashboardRows } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { requiredActionLabel } from "@/lib/labels";
import { todayDateOnly } from "@/lib/date";
import { db } from "@/lib/db";

export default async function TowersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const today = todayDateOnly();
  const query = await searchParams;
  const search = query.q?.trim() ?? "";
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const pageSize = 25;
  const where = {
    active: true,
    deletedAt: null,
    building: { customer: { organizationId: user.organizationId } },
    ...(search
      ? {
          OR: [
            { systemName: { contains: search, mode: "insensitive" as const } },
            {
              internalJobNumber: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              registrationNumber: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              building: {
                OR: [
                  {
                    buildingName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    streetAddress: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    customer: {
                      name: { contains: search, mode: "insensitive" as const },
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };
  const towerCount = await db.coolingTowerSystem.count({ where });
  const pageCount = Math.max(1, Math.ceil(towerCount / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1;
  const pageSystems = await db.coolingTowerSystem.findMany({
    where,
    select: { id: true },
    orderBy: [{ building: { buildingName: "asc" } }, { systemName: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const rows = await complianceDashboardRows({
    organizationId: user.organizationId,
    today,
    systemIds: pageSystems.map(({ id }) => id),
  });
  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Towers"
        description="Current condition, next action, deadline, and unresolved issues for every cooling tower."
      />
      <form className="panel mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="grow">
          <span className="label">Find a tower, customer, address, or job</span>
          <input
            className="field mt-1"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search the tower directory"
          />
        </label>
        <button className="btn min-h-11 justify-center">Search</button>
        {search && (
          <Link className="btn min-h-11 justify-center" href="/towers">
            Clear
          </Link>
        )}
      </form>
      <div className="panel overflow-hidden">
        <div className="hidden grid-cols-[1.1fr_.55fr_1.3fr_.75fr_.4fr] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500 lg:grid">
          <div>Tower</div>
          <div>Status</div>
          <div>Next required action</div>
          <div>Deadline</div>
          <div>Unresolved issues</div>
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
            <ClickableRow
              as="article"
              key={row.id}
              href={`/systems/${row.id}`}
              label={`Open ${row.systemName}`}
              className={`record-row grid gap-4 border-l-4 p-5 lg:grid-cols-[1.1fr_.55fr_1.3fr_.75fr_.4fr] lg:items-center ${issues ? "urgency-red" : row.complianceHealth.color === "YELLOW" ? "urgency-amber" : "border-l-slate-300"}`}
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
                {issues === 0
                  ? "No issues"
                  : `${issues} unresolved ${issues === 1 ? "issue" : "issues"}`}
              </div>
            </ClickableRow>
          );
        })}
        {!rows.length && (
          <div className="p-10 text-center">
            <b>No towers match this search.</b>
            <p className="mt-2 text-slate-600">
              Try a customer, building, address, tower, or job number.
            </p>
          </div>
        )}
        {pageCount > 1 && (
          <nav
            className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4"
            aria-label="Tower directory pages"
          >
            {page > 1 ? (
              <Link
                className="btn"
                href={`/towers?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(page > 2 ? { page: String(page - 1) } : {}) })}`}
              >
                ← Previous 25
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-bold text-slate-700">
              Page {page} of {pageCount} · {towerCount} towers
            </span>
            {page < pageCount ? (
              <Link
                className="btn"
                href={`/towers?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page + 1) })}`}
              >
                Next 25 →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </>
  );
}
