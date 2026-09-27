import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createCoolingTowerSystemAction } from "@/app/actions";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { todayDateOnly } from "@/lib/date";
import { OperatingScheduleFields } from "@/components/operating-schedule-fields";
import { SubmitButton } from "@/components/submit-button";
import { LegionellaResponsibilityFields } from "@/components/legionella-responsibility-fields";
import { ComplianceRuleProfileFields } from "@/components/compliance-rule-profile-fields";

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
        description={`Customer and address saved for ${customer.name}. Complete the three short sections below for the tower at ${building.streetAddress}, ${building.city}, ${building.state}.`}
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
          <div className="rounded-xl border-l-4 border-emerald-700 bg-emerald-50 p-4 sm:col-span-2">
            <div className="label text-emerald-800">Section 1 of 3</div>
            <h2 className="mt-1 text-lg font-black">Tower equipment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fields marked Required must be completed.
            </p>
          </div>
          <label>
            <span className="label">Tower name · Required</span>
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
            <span className="label">Model number · Required</span>
            <input className="field mt-1" name="modelNumber" required />
          </label>
          <label>
            <span className="label">Serial number · Required</span>
            <input className="field mt-1" name="serialNumber" required />
          </label>
          <label>
            <span className="label">Tower location · Required</span>
            <input
              className="field mt-1"
              name="towerLocation"
              placeholder="Roof, west mechanical yard, etc."
              required
            />
          </label>
          <label>
            <span className="label">Cooling tower tonnage · Required</span>
            <input
              className="field mt-1"
              name="tonnage"
              type="number"
              min="0.1"
              step="0.1"
              required
            />
          </label>
          <div className="mt-3 rounded-xl border-l-4 border-blue-700 bg-blue-50 p-4 sm:col-span-2">
            <div className="label text-blue-800">Section 2 of 3</div>
            <h2 className="mt-1 text-lg font-black">
              Operation and responsibility
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose who manages Legionella sampling and laboratory follow-up.
            </p>
          </div>
          <OperatingScheduleFields />
          <LegionellaResponsibilityFields />
          <div className="mt-3 rounded-xl border-l-4 border-amber-600 bg-amber-50 p-4 sm:col-span-2">
            <div className="label text-amber-900">Section 3 of 3</div>
            <h2 className="mt-1 text-lg font-black">
              Compliance rules · Administrator review
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              High-impact choice: these selections create the tower&apos;s
              future requirements and deadlines. Verify them for this address
              before saving.
            </p>
          </div>
          <ComplianceRuleProfileFields
            profiles={profiles}
            jurisdictions={jurisdictions.map((jurisdiction) => ({
              id: jurisdiction.id,
              label: jurisdictionLabel(jurisdiction),
              state: jurisdiction.state,
              city: jurisdiction.city,
            }))}
          />
          <label>
            <span className="label">Rules effective date · Required</span>
            <input
              className="field mt-1"
              name="ruleEffectiveDate"
              type="date"
              defaultValue={todayDateOnly()}
              required
            />
            <span className="mt-1 block text-xs text-slate-600">
              Enter the date as month, day, and year.
            </span>
          </label>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 sm:col-span-2">
            <div className="font-black text-amber-950">
              Before creating the tower
            </div>
            <p className="mt-1 text-sm text-amber-950">
              Jurisdiction and rules are stored on this cooling tower. NYC rules
              are never selected automatically. Choose the verified combination
              that actually applies to this address.
            </p>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton
              className="w-full"
              pendingLabel="Creating cooling tower…"
            >
              Create cooling tower
            </SubmitButton>
          </div>
        </form>
      </div>
    </>
  );
}
