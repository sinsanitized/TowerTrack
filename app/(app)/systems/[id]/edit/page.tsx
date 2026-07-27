import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { updateCustomerTowerAction } from "@/app/actions";
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

export default async function EditCustomerTowerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [system, profiles, jurisdictions] = await Promise.all([
    db.coolingTowerSystem.findFirst({
      where: {
        id,
        building: { customer: { organizationId: user.organizationId } },
      },
      include: { building: { include: { customer: true } } },
    }),
    db.ruleProfile.findMany({
      where: { active: true },
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
        description="Update the customer address, cooling tower equipment, jurisdiction, and rule profile. Rule changes recalculate event-generated obligations."
        actions={
          <Link className="btn" href={`/systems/${system.id}`}>
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
              <span className="label">Tonnage</span>
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
          <div className="label">Jurisdiction and rules</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit-tower-jurisdiction">
                Jurisdiction
              </label>
              <select
                id="edit-tower-jurisdiction"
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
            </div>
            <div>
              <label className="label" htmlFor="edit-tower-rule-profile">
                Rule profile
              </label>
              <select
                id="edit-tower-rule-profile"
                className="field mt-1"
                name="ruleProfileId"
                defaultValue={system.ruleProfileId}
                required
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-slate-600 sm:col-span-2">
              NYC rules are never a global default. Select them only for a
              verified NYC cooling tower.
            </p>
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
    </>
  );
}
