import { ComplianceDate, ComplianceWindow } from "@/components/compliance-date";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/date";
import { formatLegionellaResult, plainEnumLabel } from "@/lib/labels";
import type { complianceDashboardRows } from "@/lib/queries";

type DashboardRow = Awaited<ReturnType<typeof complianceDashboardRows>>[number];

export function TowerComplianceSnapshot({
  dashboardRow,
  latestMonthlySample,
  latestQuarterlyInspection,
}: {
  dashboardRow: DashboardRow;
  latestMonthlySample: Date | string | null;
  latestQuarterlyInspection: Date | string | null;
}) {
  return (
    <details className="panel mb-6 p-5" aria-labelledby="key-compliance-dates">
      <summary
        id="key-compliance-dates"
        className="cursor-pointer text-lg font-black"
      >
        More tower information
      </summary>
      <p className="mt-1 text-sm text-slate-600">
        Last completed dates and recurring compliance status
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel p-4">
          <div className="label">Last monthly Legionella test</div>
          <div className="mt-3">
            <ComplianceDate
              value={latestMonthlySample}
              label="Last completed"
              operational
              empty="Not recorded"
            />
          </div>
          {dashboardRow.routineSample && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <ComplianceDate
                value={dashboardRow.routineSample.latest}
                label="Next deadline"
                deadline
                compact
                operational
              />
            </div>
          )}
        </article>
        <article className="panel p-4">
          <div className="label">Quarterly inspection</div>
          <div className="mt-3">
            <ComplianceDate
              value={latestQuarterlyInspection}
              label="Last completed"
              operational
              empty="Not recorded"
            />
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <ComplianceDate
              value={dashboardRow.nextInspection?.latest}
              label="Next deadline"
              deadline
              compact
              operational
              empty="Not generated yet"
            />
          </div>
        </article>
        <article className="panel p-4">
          <div className="label">Cleanings this year</div>
          {dashboardRow.cleaning.applicable ? (
            <>
              <div className="mt-2 text-2xl font-black">
                {dashboardRow.cleaning.completed} of{" "}
                {dashboardRow.cleaning.required}
              </div>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {dashboardRow.cleaning.remaining === 0
                  ? "Annual requirement met"
                  : `${dashboardRow.cleaning.remaining} still required in ${dashboardRow.cleaning.year}`}
              </p>
              <div className="mt-3 border-t border-slate-200 pt-3">
                <ComplianceDate
                  value={dashboardRow.cleaning.lastCompletedDate}
                  label="Last cleaning"
                  operational
                  empty="Not recorded"
                />
              </div>
            </>
          ) : (
            <div className="mt-2 font-black">Not configured</div>
          )}
        </article>
        <article className="panel p-4">
          <div className="label">Summertime hyperhalogenation</div>
          {!dashboardRow.summertimeHyperhalogenation.applicable ? (
            <div className="mt-2 font-black">Not configured</div>
          ) : dashboardRow.summertimeHyperhalogenation.completedDate ? (
            <div className="mt-3">
              <ComplianceDate
                value={dashboardRow.summertimeHyperhalogenation.completedDate}
                label={`${dashboardRow.cleaning.year} completed`}
                operational
              />
            </div>
          ) : dashboardRow.summertimeHyperhalogenation.due ? (
            <div className="mt-3 space-y-3">
              <ComplianceWindow
                start={dashboardRow.summertimeHyperhalogenation.due.targetStart}
                end={dashboardRow.summertimeHyperhalogenation.due.targetEnd}
                label="Dates to complete the annual summertime hyperhalogenation"
                compact
                operational
              />
              <ComplianceDate
                value={dashboardRow.summertimeHyperhalogenation.due.latest}
                label="Deadline"
                deadline
                compact
                operational
              />
              <p className="text-xs font-bold text-slate-600">
                Completion creates a post-hyperhalogenation Legionella sample
                window.
              </p>
            </div>
          ) : (
            <div className="mt-2 font-black">
              No open summertime requirement
            </div>
          )}
        </article>
      </div>
    </details>
  );
}

type LabResult = {
  id: string;
  level: string;
  cfuPerMl: number;
  receivedDate: Date;
  sourceEventId: string;
  correctiveActionDueAt: Date | null;
  remediationDueAt: Date | null;
  chainClosed: boolean;
  sampleEvent: { eventDate: Date };
};

type ReportingAction = {
  triggerEventId: string;
  status: string;
  obligationType: string;
};

export function TowerLabResultHistory({
  results,
  reportingObligations,
}: {
  results: LabResult[];
  reportingObligations: ReportingAction[];
}) {
  if (!results.length) return null;

  return (
    <section id="samples" className="panel mb-6 scroll-mt-6 p-5">
      <div className="label">Legionella result history</div>
      <h2 className="mt-1 text-xl font-black">Recent Legionella results</h2>
      <p className="mt-1 text-sm text-slate-600">
        Result receipt is recorded as a calendar date. Exact 24- or 48-hour
        response timing requires human compliance review because no receipt time
        is collected.
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {results.slice(0, 4).map((result) => {
          const actionOpen = reportingObligations.some(
            (obligation) =>
              obligation.triggerEventId === result.sourceEventId &&
              obligation.status !== "COMPLETED" &&
              (obligation.obligationType.includes("CORRECTIVE_ACTION") ||
                obligation.obligationType === "LEVEL_4_FULL_REMEDIATION"),
          );
          const deadline =
            result.remediationDueAt ?? result.correctiveActionDueAt;
          const overdue = Boolean(
            actionOpen && deadline && deadline.getTime() < Date.now(),
          );
          return (
            <article
              key={result.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black">
                    {plainEnumLabel(result.level)} ·{" "}
                    {formatLegionellaResult(result.cfuPerMl)}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-600">
                    Sample collected {formatDate(result.sampleEvent.eventDate)}{" "}
                    · Result received {formatDate(result.receivedDate)}
                  </div>
                </div>
                <StatusBadge
                  color={
                    result.chainClosed
                      ? "GREEN"
                      : overdue
                        ? "RED"
                        : actionOpen
                          ? "YELLOW"
                          : "GREEN"
                  }
                  label={
                    result.chainClosed
                      ? "Retest chain closed"
                      : overdue
                        ? "Exact deadline overdue"
                        : actionOpen
                          ? "Corrective action open"
                          : "No corrective action open"
                  }
                />
              </div>
              {result.correctiveActionDueAt && (
                <p className="mt-3 text-sm">
                  <b>Biocide/corrective response due:</b>{" "}
                  {formatDate(result.correctiveActionDueAt)}
                </p>
              )}
              {result.remediationDueAt && (
                <p className="mt-2 text-sm">
                  <b>Full remediation due:</b>{" "}
                  {formatDate(result.remediationDueAt)}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
