import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createCoolingTowerSystemAction } from "@/app/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { todayDateOnly } from "@/lib/date";
import { OperatingScheduleFields } from "@/components/operating-schedule-fields";
import {
  towerRuleConfigurationForMode,
  towerRuleConfigurationLabel,
} from "@/lib/tower-rule-configuration";

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

export default async function NewCoolingTowerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ buildingId?: string }>;
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const { id } = await params;
  const { buildingId } = await searchParams;
  const [customer, profiles, jurisdictions] = await Promise.all([
    db.customer.findFirst({
      where: { id, organizationId: user.organizationId, active: true },
      include: { buildings: { where: { active: true } } },
    }),
    db.ruleProfile.findMany({
      where: {
        active: true,
        OR: [{ organizationId: null }, { organizationId: user.organizationId }],
      },
      include: { jurisdiction: true },
      orderBy: { name: "asc" },
    }),
    db.jurisdiction.findMany({ orderBy: [{ state: "asc" }, { city: "asc" }] }),
  ]);
  if (!customer) notFound();
  const building =
    customer.buildings.find((item) => item.id === buildingId) ||
    customer.buildings[0];
  if (!building) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Customer setup · Step 2 of 2"
        title="Add cooling tower details"
        description={`Customer and address saved for ${customer.name}. Now identify the cooling tower equipment at ${building.streetAddress}, ${building.city}, ${building.state}.`}
      />
      <div className="panel mx-auto max-w-3xl p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-900">
            ✓ Step 1 · Customer and address
          </span>
          <span className="rounded-full bg-emerald-800 px-2 py-1 text-white">
            Step 2 · Cooling tower
          </span>
        </div>
        <form
          action={createCoolingTowerSystemAction}
          className="grid gap-5 sm:grid-cols-2"
        >
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="buildingId" value={building.id} />
          <label>
            <span className="label">Tower name</span>
            <input
              className="field mt-1"
              name="systemName"
              defaultValue="CT-1"
              required
            />
          </label>
          <label>
            <span className="label">Manufacturer (optional)</span>
            <input className="field mt-1" name="manufacturer" />
          </label>
          <label>
            <span className="label">Model number</span>
            <input className="field mt-1" name="modelNumber" required />
          </label>
          <label>
            <span className="label">Serial number</span>
            <input className="field mt-1" name="serialNumber" required />
          </label>
          <label>
            <span className="label">Tower location</span>
            <input
              className="field mt-1"
              name="towerLocation"
              placeholder="Roof, west mechanical yard, etc."
              required
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
              required
            />
          </label>
          <OperatingScheduleFields />
          <label>
            <span className="label">Legionella Responsibility</span>
            <select
              className="field mt-1"
              name="legionellaResponsibility"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Choose responsibility
              </option>
              <option value="OUR_COMPANY">
                Our company manages Legionella
              </option>
              <option value="CUSTOMER">Customer manages Legionella</option>
              <option value="OTHER_VENDOR">
                Another vendor manages Legionella
              </option>
              <option value="NOT_TRACKED">
                Do not track Legionella in TowerTrack
              </option>
            </select>
          </label>
          <label>
            <span className="label">
              Legionella vendor name (when applicable)
            </span>
            <input className="field mt-1" name="legionellaVendorName" />
          </label>
          <div>
            <label className="label" htmlFor="new-tower-jurisdiction">
              Jurisdiction
            </label>
            <select
              id="new-tower-jurisdiction"
              className="field mt-1"
              name="jurisdictionId"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Choose jurisdiction
              </option>
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction.id} value={jurisdiction.id}>
                  {jurisdictionLabel(jurisdiction)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-tower-rule-configuration">
              Compliance rules
            </label>
            <select
              id="new-tower-rule-configuration"
              className="field mt-1"
              name="ruleConfiguration"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Choose configuration
              </option>
              <option value="NYC_AND_NYS">NYC Chapter 8 and NYS Part 4</option>
              <option value="NYS_ONLY">NYS Part 4 only</option>
              <option value="CUSTOM">Custom or out-of-state</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-tower-rule-profile">
              Profile version
            </label>
            <select
              id="new-tower-rule-profile"
              className="field mt-1"
              name="ruleProfileId"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Choose rule profile
              </option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {towerRuleConfigurationLabel(
                    towerRuleConfigurationForMode(profile.jurisdictionMode),
                  )}{" "}
                  — {profile.name}
                </option>
              ))}
            </select>
          </div>
          <label>
            <span className="label">Effective date</span>
            <input
              className="field mt-1"
              name="ruleEffectiveDate"
              type="date"
              defaultValue={todayDateOnly()}
              required
            />
          </label>
          <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
            <p className="mt-2 text-xs text-slate-500">
              Jurisdiction and rules are stored on this cooling tower. NYC rules
              are never selected automatically. Choose the verified combination
              that actually applies to this address.
            </p>
          </div>
          <div className="sm:col-span-2">
            <button className="btn btn-primary w-full">
              Create cooling tower
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
