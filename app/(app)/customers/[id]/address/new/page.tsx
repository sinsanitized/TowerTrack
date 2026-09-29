import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { addCustomerAddressAction } from "@/app/actions/customers";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AddCustomerAddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const { id } = await params;
  const customer = await db.customer.findFirst({
    where: {
      id,
      organizationId: user.organizationId,
      active: true,
      buildings: { none: {} },
    },
    select: { id: true, name: true },
  });
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Customer setup"
        title={`Add address for ${customer.name}`}
        description="Save the customer site address, then continue directly to cooling tower setup."
        actions={
          <Link className="btn" href="/customers">
            Cancel
          </Link>
        }
      />
      <form
        action={addCustomerAddressAction}
        className="panel mx-auto max-w-2xl space-y-4 p-6"
      >
        <input type="hidden" name="customerId" value={customer.id} />
        <p className="text-sm font-bold text-slate-700">
          Fields marked Required must be completed.
        </p>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">City · Required</span>
            <input className="field mt-1" name="city" required />
          </label>
          <label>
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
          Saving this address continues to cooling tower equipment setup.
        </div>
        <SubmitButton
          className="w-full"
          pendingLabel="Saving customer address…"
        >
          Save address and continue
        </SubmitButton>
      </form>
    </>
  );
}
