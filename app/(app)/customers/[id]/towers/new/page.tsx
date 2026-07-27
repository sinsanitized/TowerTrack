import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createCoolingTowerSystemAction } from "@/app/actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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
  const user = await requireUser();
  const { id } = await params;
  const { buildingId } = await searchParams;
  const [customer, profiles, jurisdictions] = await Promise.all([
    db.customer.findFirst({
      where: { id, organizationId: user.organizationId, active: true },
      include: { buildings: { where: { active: true } } },
    }),
    db.ruleProfile.findMany({
      where: { active: true },
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
            <span className="label">Tonnage</span>
            <input
              className="field mt-1"
              name="tonnage"
              type="number"
              min="0.1"
              step="0.1"
              required
            />
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
            <label className="label" htmlFor="new-tower-rule-profile">
              Rule profile
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
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
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
