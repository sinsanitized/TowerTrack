import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ClickableTableRow } from "@/components/clickable-row";
import { createCustomerAction } from "@/app/actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";

export default async function CustomersPage() {
  const user = await requireUser();
  const customers = await db.customer.findMany({
    where: { organizationId: user.organizationId, active: true },
    include: {
      buildings: {
        include: {
          systems: { orderBy: { systemName: "asc" } },
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
  };
  const rows: CustomerRow[] = [];
  for (const customer of customers) {
    if (!customer.buildings.length) {
      rows.push({
        customer,
        building: null,
        system: null,
      });
      continue;
    }
    for (const building of customer.buildings) {
      if (!building.systems.length) {
        rows.push({
          customer,
          building,
          system: null,
        });
        continue;
      }
      for (const system of building.systems)
        rows.push({
          customer,
          building,
          system,
        });
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Customers & sites"
        title="Customers"
        description="Create the customer and address first, then add the cooling tower equipment details."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <section
          className="panel table-wrap"
          aria-labelledby="customer-directory-heading"
        >
          <div className="border-b border-slate-200 p-5">
            <div className="label">Customer and site directory</div>
            <h2
              id="customer-directory-heading"
              className="mt-1 text-xl font-black"
            >
              Find a customer or cooling tower
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Open an existing tower or continue an unfinished setup.
            </p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Building / tower</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ customer, building, system }) => {
                const primaryHref = system
                  ? `/systems/${system.id}`
                  : building
                    ? `/customers/${customer.id}/towers/new?buildingId=${building.id}`
                    : null;
                return (
                  <ClickableTableRow
                    key={system?.id || building?.id || customer.id}
                    href={primaryHref}
                    label={
                      system
                        ? `Open ${system.systemName}`
                        : building
                          ? `Continue tower setup for ${customer.name}`
                          : undefined
                    }
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                          <Building2 size={18} />
                        </span>
                        <div>
                          <div className="font-black">{customer.name}</div>
                          <div className="text-xs text-slate-500">
                            Customer account number: {customer.accountNumber}
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
                              : "Customer saved—tower details needed · "}
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
                          Continue tower setup
                        </Link>
                      ) : null}
                    </td>
                  </ClickableTableRow>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="p-10 text-center">
              <b>No customer systems yet.</b>
              <p className="mt-2 text-slate-600">
                Add your first customer here, or import existing buildings and
                towers from Settings.
              </p>
            </div>
          )}
        </section>
        <aside className="panel p-5 xl:sticky xl:top-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            <span className="rounded-full bg-emerald-800 px-2 py-1 text-white">
              Step 1 of 2
            </span>
            Customer and address
          </div>
          <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
            <Plus size={18} />
            <h2 className="font-black">Add customer</h2>
          </div>
          <form action={createCustomerAction} className="mt-5 space-y-4">
            <p className="text-sm font-bold text-slate-700">
              Fields marked Required must be completed.
            </p>
            <label className="block">
              <span className="label">Customer name · Required</span>
              <input className="field mt-1" name="name" required />
            </label>
            <label className="block">
              <span className="label">Street address · Required</span>
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
                <span className="label">City · Required</span>
                <input className="field mt-1" name="city" required />
              </label>
              <label className="block">
                <span className="label">State · Required</span>
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
              <span className="label">ZIP code · Required</span>
              <input
                className="field mt-1"
                name="postalCode"
                autoComplete="postal-code"
                required
              />
            </label>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              This saves the customer and address now. You will enter cooling
              tower equipment on the next screen, and you can resume later.
            </div>
            <SubmitButton
              className="w-full"
              pendingLabel="Saving customer and address…"
            >
              Continue to cooling tower details
            </SubmitButton>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            The internal account number is generated automatically.
          </p>
        </aside>
      </div>
    </>
  );
}
