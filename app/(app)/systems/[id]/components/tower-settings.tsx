import Link from "next/link";
import type { TowerRuleConfiguration } from "@prisma/client";
import { OperationPatternForm } from "@/components/operation-pattern-form";
import { MonthlyTargetWindowForm } from "@/components/monthly-target-window-form";
import { formatDate } from "@/lib/date";
import { plainEnumLabel } from "@/lib/labels";
import { seasonLabel, seasonalStatus } from "@/lib/season";
import { towerRuleConfigurationLabel } from "@/lib/tower-rule-configuration";

type SettingsSystem = {
  seasonal: boolean;
  operationPeriodType: string | null;
  seasonStartMonth: number;
  seasonStartDay: number;
  seasonEndMonth: number;
  seasonEndDay: number;
  actualStartupDate: Date | null;
  actualShutdownDate: Date | null;
  monthlyTargetStartDay: number;
  monthlyTargetEndDay: number;
  ruleConfiguration: TowerRuleConfiguration;
  operatingStatus: string;
  ruleProfile: { name: string };
  jurisdiction: { city: string | null; county: string | null; state: string };
  pendingRegulation: { expectedRuleName: string; status: string } | null;
};

export function TowerSettings({
  systemId,
  system,
  profileVersion,
  profileEffectiveDate,
  profileJurisdiction,
  profileAudit,
}: {
  systemId: string;
  system: SettingsSystem;
  profileVersion: string;
  profileEffectiveDate: string | Date | null;
  profileJurisdiction: string;
  profileAudit: { changedAt: Date; changedBy: { name: string } } | null;
}) {
  return (
    <>
      <div className="space-y-6">
        <section
          id="service-responsibilities"
          className="panel scroll-mt-6 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <div className="label">1. Service responsibilities</div>
              <h2 className="mt-1 font-black">Who performs each service</h2>
              <p className="mt-1 text-sm text-slate-600">
                These assignments determine which work appears in our queues and
                which work remains an external dependency. Saved separately.
              </p>
            </div>
            <Link
              className="btn btn-primary"
              href={`/systems/${systemId}/edit?section=responsibilities&returnTo=${encodeURIComponent(`/systems/${systemId}?view=settings`)}`}
            >
              Edit service responsibilities
            </Link>
          </div>
        </section>
        <section className="panel p-4 sm:p-5">
          <div className="label">2. Operating schedule</div>
          <h2 className="font-black">Tower operation pattern</h2>
          <p className="mt-1 text-sm font-bold text-slate-700">
            {seasonLabel(system)} · {seasonalStatus(system)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Choose whether this tower operates continuously or during a
            recurring season. This controls date calculations; actual startup
            and shutdown remain separate audited events.
          </p>
          <OperationPatternForm
            systemId={systemId}
            seasonal={system.operationPeriodType === "SEASONAL"}
            seasonStartMonth={system.seasonStartMonth}
            seasonStartDay={system.seasonStartDay}
            seasonEndMonth={system.seasonEndMonth}
            seasonEndDay={system.seasonEndDay}
            currentLabel={seasonLabel(system)}
            currentStatus={seasonalStatus(system)}
          />
        </section>
        <section className="panel p-4 sm:p-5">
          <div className="label">3. Recommended service dates</div>
          <h2 className="font-black">
            Recommended monthly sample collection dates
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This recommended service date stays stable; the compliance deadline
            still comes from the last qualifying sample.
          </p>
          <MonthlyTargetWindowForm
            systemId={systemId}
            startDay={system.monthlyTargetStartDay}
            endDay={system.monthlyTargetEndDay}
          />
        </section>
      </div>
      <div className="mt-6">
        <section className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="label">4. Jurisdiction and compliance rules</div>
              <h2 className="mt-1 font-black">Current rule assignment</h2>
            </div>
            <Link
              className="btn"
              href={`/systems/${systemId}/edit?section=rules&returnTo=${encodeURIComponent(`/systems/${systemId}?view=settings`)}`}
            >
              Change compliance rules
            </Link>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="label">Profile</dt>
              <dd className="font-bold">{system.ruleProfile.name}</dd>
            </div>
            <div>
              <dt className="label">Compliance rules</dt>
              <dd className="font-bold">
                {towerRuleConfigurationLabel(system.ruleConfiguration)}
              </dd>
            </div>
            <div>
              <dt className="label">Profile version</dt>
              <dd className="break-all font-mono text-xs">{profileVersion}</dd>
            </div>
            <div>
              <dt className="label">Effective date</dt>
              <dd className="font-bold">{formatDate(profileEffectiveDate)}</dd>
            </div>
            <div>
              <dt className="label">Profile review</dt>
              <dd className="font-bold">
                {profileJurisdiction === "CUSTOM"
                  ? "Review local requirements and enabled policy rules"
                  : "Assigned profile active"}
              </dd>
            </div>
            <div>
              <dt className="label">Assigned / last changed by</dt>
              <dd className="font-bold">
                {profileAudit
                  ? `${profileAudit.changedBy.name} · ${formatDate(profileAudit.changedAt)}`
                  : "Historical assignment — audit detail unavailable"}
              </dd>
            </div>
            <div>
              <dt className="label">Jurisdiction</dt>
              <dd>
                {[
                  system.jurisdiction.city,
                  system.jurisdiction.county,
                  system.jurisdiction.state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="label">Operating status</dt>
              <dd className="capitalize">
                {system.operatingStatus.replaceAll("_", " ").toLowerCase()}
              </dd>
            </div>
            {system.pendingRegulation && (
              <div>
                <dt className="label">Pending regulation</dt>
                <dd className="font-bold text-purple-800">
                  {system.pendingRegulation.expectedRuleName} ·{" "}
                  {plainEnumLabel(system.pendingRegulation.status)}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </>
  );
}
