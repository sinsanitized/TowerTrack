import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { ActivityType } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { createCustomerAction } from "@/app/actions";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date";
import { requireUser } from "@/lib/auth";

const legionellaTypes = [
  ActivityType.ROUTINE_LEGIONELLA_SAMPLE,
  ActivityType.STARTUP_LEGIONELLA_SAMPLE,
  ActivityType.POST_HYPERHALOGENATION_SAMPLE,
  ActivityType.CORRECTIVE_RETEST,
  ActivityType.EMERGENCY_SAMPLE,
];

const cleaningTypes = [
  ActivityType.ROUTINE_CLEANING,
  ActivityType.STARTUP_CLEANING,
  ActivityType.CLEANING,
  ActivityType.DISINFECTION,
  ActivityType.CLEANING_AND_DISINFECTION,
  ActivityType.CORRECTIVE_DISINFECTION,
  ActivityType.FULL_REMEDIATION,
];

function latestActivityDate(
  activities: { activityType: ActivityType; performedDate: Date | null }[],
  types: ActivityType[],
) {
  return (
    activities
      .filter(
        (activity) =>
          activity.performedDate && types.includes(activity.activityType),
      )
      .map((activity) => activity.performedDate as Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null
  );
}

export default async function CustomersPage() {
  const user = await requireUser();
  const customers = await db.customer.findMany({
    where: { organizationId: user.organizationId, active: true },
    include: {
      buildings: {
        include: {
          systems: {
            include: {
              activities: {
                where: {
                  status: "COMPLETED",
                  performedDate: { not: null },
                  activityType: { in: [...legionellaTypes, ...cleaningTypes] },
                },
                orderBy: { performedDate: "desc" },
              },
            },
            orderBy: { systemName: "asc" },
          },
        },
        orderBy: { buildingName: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  type CustomerRow = {
    customer: (typeof customers)[number];
    building: (typeof customers)[number]["buildings"][number] | null;
    system:
      (typeof customers)[number]["buildings"][number]["systems"][number] | null;
    lastLegionella: Date | null;
    lastCleaning: Date | null;
  };
  const rows: CustomerRow[] = [];
  for (const customer of customers) {
    if (!customer.buildings.length) {
      rows.push({
        customer,
        building: null,
        system: null,
        lastLegionella: null,
        lastCleaning: null,
      });
      continue;
    }
    for (const building of customer.buildings) {
      if (!building.systems.length) {
        rows.push({
          customer,
          building,
          system: null,
          lastLegionella: null,
          lastCleaning: null,
        });
        continue;
      }
      for (const system of building.systems)
        rows.push({
          customer,
          building,
          system,
          lastLegionella: latestActivityDate(
            system.activities,
            legionellaTypes,
          ),
          lastCleaning: latestActivityDate(system.activities, cleaningTypes),
        });
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Customers & sites"
        title="Customer Information"
        description="Create the customer and address first, then add the cooling tower equipment details."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Building / tower</th>
                <th>Last Legionella test</th>
                <th>Last cleaning</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({
                  customer,
                  building,
                  system,
                  lastLegionella,
                  lastCleaning,
                }) => (
                  <tr key={system?.id || building?.id || customer.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                          <Building2 size={18} />
                        </span>
                        <div>
                          <div className="font-black">{customer.name}</div>
                          <div className="text-xs text-slate-500">
                            Account {customer.accountNumber}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {building ? (
                        <>
                          <div className="font-bold">
                            {building.streetAddress}
                          </div>
                          <div className="text-xs text-slate-500">
                            {system
                              ? `${system.systemName} · `
                              : "Cooling tower details not added · "}
                            {building.city}, {building.state}
                          </div>
                        </>
                      ) : (
                        <div className="font-bold text-slate-500">
                          Address not added
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-lg font-black">
                        {formatDate(lastLegionella)}
                      </div>
                    </td>
                    <td>
                      <div className="text-lg font-black">
                        {formatDate(lastCleaning)}
                      </div>
                    </td>
                    <td>
                      {system ? (
                        <div className="flex flex-wrap gap-2">
                          <Link className="btn" href={`/systems/${system.id}`}>
                            Open tower
                          </Link>
                          <Link
                            className="btn"
                            href={`/systems/${system.id}/edit`}
                          >
                            Edit details
                          </Link>
                        </div>
                      ) : building ? (
                        <Link
                          className="btn btn-primary"
                          href={`/customers/${customer.id}/towers/new?buildingId=${building.id}`}
                        >
                          Add tower details
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {!rows.length && (
            <div className="p-10 text-center">
              <b>No customer systems yet.</b>
              <p className="mt-2 text-slate-600">
                Import buildings and towers from Admin.
              </p>
            </div>
          )}
        </div>
        <aside className="panel p-5">
          <div className="flex items-center gap-2">
            <Plus size={18} />
            <h2 className="font-black">Add customer</h2>
          </div>
          <form action={createCustomerAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="label">Customer name</span>
              <input className="field mt-1" name="name" required />
            </label>
            <label className="block">
              <span className="label">Street address</span>
              <input
                className="field mt-1"
                name="streetAddress"
                autoComplete="street-address"
                required
              />
            </label>
            <label className="block">
              <span className="label">Suite / unit (optional)</span>
              <input className="field mt-1" name="addressLine2" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">City</span>
                <input className="field mt-1" name="city" required />
              </label>
              <label className="block">
                <span className="label">State</span>
                <input
                  className="field mt-1 uppercase"
                  name="state"
                  maxLength={2}
                  placeholder="NY"
                  required
                />
              </label>
            </div>
            <label className="block">
              <span className="label">ZIP code</span>
              <input
                className="field mt-1"
                name="postalCode"
                autoComplete="postal-code"
                required
              />
            </label>
            <button className="btn btn-primary w-full">
              Continue to cooling tower details
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            The internal account number is generated automatically. Jurisdiction
            and rules are selected in the next step.
          </p>
        </aside>
      </div>
    </>
  );
}
