import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ClickableTableRow } from "@/components/clickable-row";
import { createCustomerAction } from "@/app/actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/submit-button";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const search = query.q?.trim() ?? "";
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const pageSize = 25;
  const where = {
    organizationId: user.organizationId,
    active: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            {
              accountNumber: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              buildings: {
                some: {
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
                      systems: {
                        some: {
                          OR: [
                            {
                              systemName: {
                                contains: search,
                                mode: "insensitive" as const,
                              },
                            },
                            {
                              internalJobNumber: {
                                contains: search,
                                mode: "insensitive" as const,
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
  const customerCount = await db.customer.count({ where });
  const pageCount = Math.max(1, Math.ceil(customerCount / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1;
  const customers = await db.customer.findMany({
    where,
    include: {
      buildings: {
        include: {
          systems: { orderBy: { systemName: "asc" } },
        },
        orderBy: { buildingName: "asc" },
      },
    },
    orderBy: { name: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
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
      <details className="panel mb-6 overflow-hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 font-black text-emerald-900">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-50">
            <Plus size={18} />
          </span>
          <span>
            Add a new customer
            <span className="mt-0.5 block text-sm font-medium text-slate-600">
              Step 1 of 2 · Customer and address
            </span>
          </span>
        </summary>
        <form
          action={createCustomerAction}
          className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <p className="text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
            Fields marked Required must be completed. Tower equipment is added
            on the next screen.
          </p>
          <label className="block">
            <span className="label">Customer name · Required</span>
            <input className="field mt-1" name="name" required />
          </label>
          <label className="block sm:col-span-1 lg:col-span-2">
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
          <label className="block">
            <span className="label">City · Required</span>
            <input className="field mt-1" name="city" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
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
            <label className="block">
              <span className="label">ZIP code · Required</span>
              <input
                className="field mt-1"
                name="postalCode"
                autoComplete="postal-code"
                required
              />
            </label>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 sm:col-span-2 lg:col-span-3 sm:flex-row sm:items-center">
            <span>
              Saving continues to cooling tower details. You can also resume
              later from this directory.
            </span>
            <SubmitButton
              className="shrink-0"
              pendingLabel="Saving customer and address…"
            >
              Continue to cooling tower details
            </SubmitButton>
          </div>
        </form>
      </details>
      <form className="panel mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="grow">
          <span className="label">Find a customer, address, tower, or job</span>
          <input
            className="field mt-1"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search the customer directory"
          />
        </label>
        <button className="btn min-h-11 justify-center">Search</button>
        {search && (
          <Link className="btn min-h-11 justify-center" href="/customers">
            Clear
          </Link>
        )}
      </form>
      <div>
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
                    : `/customers/${customer.id}/address/new`;
                return (
                  <ClickableTableRow
                    key={system?.id || building?.id || customer.id}
                    href={primaryHref}
                    label={
                      system
                        ? `Open ${system.systemName}`
                        : building
                          ? `Continue tower setup for ${customer.name}`
                          : `Add customer address for ${customer.name}`
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
                      ) : (
                        <Link
                          className="btn btn-primary"
                          href={`/customers/${customer.id}/address/new`}
                        >
                          Add customer address
                        </Link>
                      )}
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
          {pageCount > 1 && (
            <nav
              className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4"
              aria-label="Customer directory pages"
            >
              {page > 1 ? (
                <Link
                  className="btn"
                  href={`/customers?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(page > 2 ? { page: String(page - 1) } : {}) })}`}
                >
                  ← Previous 25
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm font-bold text-slate-700">
                Page {page} of {pageCount} · {customerCount} customers
              </span>
              {page < pageCount ? (
                <Link
                  className="btn"
                  href={`/customers?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page + 1) })}`}
                >
                  Next 25 →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
