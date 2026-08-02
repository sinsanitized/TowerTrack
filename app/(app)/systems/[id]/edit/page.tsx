import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  changeTowerRuleConfigurationAction,
  updateCustomerTowerAction,
  updateServiceResponsibilityAction,
} from "@/app/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import {
  towerRuleConfigurationForMode,
  towerRuleConfigurationLabel,
} from "@/lib/tower-rule-configuration";
import { formatDate, todayDateOnly } from "@/lib/date";
import { OperationPatternForm } from "@/components/operation-pattern-form";
import { seasonLabel, seasonalStatus } from "@/lib/season";
import {
  serviceResponsibilityFamilies,
  serviceResponsibilityLabel,
} from "@/lib/service-responsibility";

function jurisdictionLabel(jurisdiction: {
  city: string | null;
  county: string | null;
  municipality: string | null;
  state: string;
}) {
  return [
    jurisdiction.city,
    jurisdiction.county,
    jurisdiction.municipality,
    jurisdiction.state,
  ]
    .filter(Boolean)
    .join(", ");
}

export default async function EditCustomerTowerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; returnTo?: string }>;
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const { id } = await params;
  const { focus, returnTo: requestedReturnTo } = await searchParams;
  const returnTo =
    requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : null;
  const focusedResponsibility = serviceResponsibilityFamilies.some(
    ([key]) => key === focus,
  )
    ? focus
    : null;
  const [system, profiles, jurisdictions] = await Promise.all([
    db.coolingTowerSystem.findFirst({
      where: {
        id,
        building: { customer: { organizationId: user.organizationId } },
      },
      include: {
        building: { include: { customer: true } },
        ruleProfile: true,
        ruleAssignments: {
          include: {
            ruleProfile: true,
            changedBy: { select: { name: true } },
          },
          orderBy: { effectiveStartDate: "desc" },
        },
      },
    }),
    db.ruleProfile.findMany({
      where: {
        active: true,
        OR: [{ organizationId: null }, { organizationId: user.organizationId }],
      },
      orderBy: { name: "asc" },
    }),
    db.jurisdiction.findMany({ orderBy: [{ state: "asc" }, { city: "asc" }] }),
  ]);
  if (!system) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Customer and tower settings"
        title={`Edit ${system.building.customer.name} — ${system.systemName}`}
        description="Update verified customer, address, and equipment information. Compliance-rule changes use a separate effective-dated workflow below."
        actions={
          <Link className="btn" href={returnTo ?? `/systems/${system.id}`}>
            Cancel
          </Link>
        }
      />
      <form
        action={updateCustomerTowerAction}
        className="mx-auto max-w-4xl space-y-6"
      >
        <input type="hidden" name="systemId" value={system.id} />
        <section className="panel p-6">
          <div className="label">Customer and address</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Customer name</span>
              <input
                className="field mt-1"
                name="customerName"
                defaultValue={system.building.customer.name}
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Street address</span>
              <input
                className="field mt-1"
                name="streetAddress"
                defaultValue={system.building.streetAddress}
                required
              />
            </label>
            <label>
              <span className="label">Suite / unit (optional)</span>
              <input
                className="field mt-1"
                name="addressLine2"
                defaultValue={system.building.addressLine2 || ""}
              />
            </label>
            <label>
              <span className="label">City</span>
              <input
                className="field mt-1"
                name="city"
                defaultValue={system.building.city}
                required
              />
            </label>
            <label>
              <span className="label">State</span>
              <input
                className="field mt-1 uppercase"
                name="state"
                maxLength={2}
                defaultValue={system.building.state}
                required
              />
            </label>
            <label>
              <span className="label">ZIP code</span>
              <input
                className="field mt-1"
                name="postalCode"
                defaultValue={system.building.postalCode}
                required
              />
            </label>
          </div>
        </section>
        <section className="panel p-6">
          <div className="label">Cooling tower equipment</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Tower name</span>
              <input
                className="field mt-1"
                name="systemName"
                defaultValue={system.systemName}
                required
              />
            </label>
            <label>
              <span className="label">Manufacturer (optional)</span>
              <input
                className="field mt-1"
                name="manufacturer"
                defaultValue={system.manufacturer || ""}
              />
            </label>
            <label>
              <span className="label">Model number</span>
              <input
                className="field mt-1"
                name="modelNumber"
                defaultValue={system.modelNumber || ""}
              />
            </label>
            <label>
              <span className="label">Serial number</span>
              <input
                className="field mt-1"
                name="serialNumber"
                defaultValue={system.serialNumber || ""}
              />
            </label>
            <label>
              <span className="label">Tower location</span>
              <input
                className="field mt-1"
                name="towerLocation"
                defaultValue={system.towerLocation || ""}
              />
            </label>
            <label>
              <span className="label">Cooling tower tonnage</span>
              <input
                className="field mt-1"
                name="tonnage"
                type="number"
                min="0.1"
                step="0.1"
                defaultValue={system.tonnage || ""}
              />
            </label>
          </div>
        </section>
        <section className="panel p-6">
          <label>
            <span className="label">Reason for changes</span>
            <input
              className="field mt-1"
              name="reason"
              minLength={8}
              defaultValue="Update verified customer and tower information"
              required
            />
          </label>
          <button className="btn btn-primary mt-4 w-full">
            Save customer and tower changes
          </button>
        </section>
      </form>
      <section
        id="service-responsibilities"
        className="panel mx-auto mt-6 max-w-4xl scroll-mt-6 p-6"
      >
        <div className="label">Service responsibilities</div>
        <h2 className="mt-1 text-xl font-black">
          Who is responsible for each service
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This controls operational ownership only. It does not change the legal
          requirements assigned to this tower.
        </p>
        {focusedResponsibility && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">
            Assign the highlighted service responsibility, then save this
            section.
          </div>
        )}
        {serviceResponsibilityFamilies.some(([key]) => system[key] == null) && (
          <div className="mt-4 rounded-lg border border-purple-300 bg-purple-50 p-3 text-sm font-bold text-purple-900">
            One or more service responsibilities must be confirmed. Unknown work
            remains visible until ownership is assigned.
          </div>
        )}
        <form
          action={updateServiceResponsibilityAction}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="systemId" value={system.id} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          {serviceResponsibilityFamilies.map(([key, label]) => (
            <label
              key={key}
              className={
                focusedResponsibility === key
                  ? "rounded-lg border-2 border-blue-400 bg-blue-50 p-3"
                  : undefined
              }
            >
              <span className="label">{label}</span>
              <select
                className="field mt-1"
                name={key}
                defaultValue={system[key] ?? ""}
                autoFocus={focusedResponsibility === key}
                required
              >
                <option value="" disabled>
                  Select responsible party
                </option>
                <option value="OUR_COMPANY">Our company</option>
                <option value="CUSTOMER">Customer</option>
                <option value="OTHER_VENDOR">Another vendor</option>
                <option value="NOT_TRACKED">Reference only</option>
              </select>
            </label>
          ))}
          <label>
            <span className="label">Vendor name (when applicable)</span>
            <input
              className="field mt-1"
              name="legionellaVendorName"
              defaultValue={system.legionellaVendorName ?? ""}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Reason</span>
            <input
              className="field mt-1"
              name="reason"
              defaultValue="Confirm contracted service responsibility"
              minLength={8}
              required
            />
          </label>
          <div className="grid gap-1 text-sm text-slate-600 sm:col-span-2 sm:grid-cols-2">
            {serviceResponsibilityFamilies.map(([key, label]) => (
              <div key={key}>
                <span className="font-bold">{label}:</span>{" "}
                {serviceResponsibilityLabel(system[key])}
              </div>
            ))}
          </div>
          <button className="btn btn-primary sm:col-span-2">
            Save service responsibilities
          </button>
        </form>
      </section>
      <section className="panel mx-auto mt-6 max-w-4xl p-6">
        <div className="label">Operating schedule</div>
        <p className="mt-2 text-sm text-slate-600">
          This planning setting is separate from audited startup and shutdown
          events. Seasonal details appear only for a seasonal tower.
        </p>
        <OperationPatternForm
          systemId={system.id}
          seasonal={system.operationPeriodType === "SEASONAL"}
          seasonStartMonth={system.seasonStartMonth}
          seasonStartDay={system.seasonStartDay}
          seasonEndMonth={system.seasonEndMonth}
          seasonEndDay={system.seasonEndDay}
          currentLabel={
            system.operationPeriodType == null
              ? "Schedule not set"
              : seasonLabel(system)
          }
          currentStatus={
            system.operationPeriodType == null
              ? "Review required"
              : seasonalStatus(system)
          }
        />
      </section>
      <section className="panel mx-auto mt-6 max-w-4xl p-6">
        <div className="label">Compliance rules</div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">
              {towerRuleConfigurationLabel(system.ruleConfiguration)}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {system.ruleProfile.name} · Effective{" "}
              {formatDate(system.ruleConfigurationEffectiveDate)}
            </p>
          </div>
          {!system.ruleConfigurationConfirmed && (
            <div className="rounded-lg bg-purple-100 px-3 py-2 text-sm font-black text-purple-900">
              Compliance rules must be confirmed.
            </div>
          )}
        </div>
        <details className="mt-5 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-black text-emerald-900">
            Change compliance rules
          </summary>
          <form
            action={changeTowerRuleConfigurationAction}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="systemId" value={system.id} />
            <label>
              <span className="label">Rule configuration</span>
              <select
                className="field mt-1"
                name="ruleConfiguration"
                defaultValue={system.ruleConfiguration}
                required
              >
                <option value="NYC_AND_NYS">
                  NYC Chapter 8 and NYS Part 4
                </option>
                <option value="NYS_ONLY">NYS Part 4 only</option>
                <option value="CUSTOM">Custom or out-of-state</option>
              </select>
            </label>
            <label>
              <span className="label">Jurisdiction</span>
              <select
                className="field mt-1"
                name="jurisdictionId"
                defaultValue={system.jurisdictionId}
                required
              >
                {jurisdictions.map((jurisdiction) => (
                  <option key={jurisdiction.id} value={jurisdiction.id}>
                    {jurisdictionLabel(jurisdiction)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Assigned profile version</span>
              <select
                className="field mt-1"
                name="ruleProfileId"
                defaultValue={system.ruleProfileId}
                required
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {towerRuleConfigurationLabel(
                      towerRuleConfigurationForMode(profile.jurisdictionMode),
                    )}{" "}
                    — {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Effective date</span>
              <input
                className="field mt-1"
                name="effectiveDate"
                type="date"
                min={todayDateOnly()}
                max={todayDateOnly()}
                defaultValue={todayDateOnly()}
                required
              />
            </label>
            <label>
              <span className="label">Reason</span>
              <input
                className="field mt-1"
                name="reason"
                minLength={8}
                defaultValue="Change verified tower compliance rules"
                required
              />
            </label>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2">
              <div className="font-black">Compliance impact preview</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  The current assignment will end the day before the effective
                  date.
                </li>
                <li>
                  Open requirements will be recalculated under the selected
                  jurisdiction and profile.
                </li>
                <li>
                  Historical events and prior effective-dated assignments remain
                  unchanged.
                </li>
              </ul>
              <label className="mt-3 flex items-start gap-2 font-bold">
                <input
                  name="impactConfirmed"
                  type="checkbox"
                  value="yes"
                  required
                />
                I reviewed the jurisdiction, effective date, and recalculation
                impact.
              </label>
            </div>
            <button className="btn btn-primary sm:col-span-2">
              Change compliance rules
            </button>
          </form>
        </details>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-bold text-emerald-900">
            Assignment history
          </summary>
          <div className="mt-3 space-y-3">
            {system.ruleAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg bg-slate-50 p-3">
                <div className="font-black">
                  {towerRuleConfigurationLabel(assignment.configuration)}
                </div>
                <div className="text-slate-600">
                  {assignment.ruleProfile.name} ·{" "}
                  {formatDate(assignment.effectiveStartDate)}
                  {assignment.effectiveEndDate
                    ? ` through ${formatDate(assignment.effectiveEndDate)}`
                    : " onward"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {assignment.changedBy?.name ??
                    "Imported historical assignment"}{" "}
                  · {assignment.reason}
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>
    </>
  );
}
