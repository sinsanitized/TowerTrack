"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

const customerAddressFields = {
  streetAddress: z.string().trim().min(3),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().length(2),
  postalCode: z.string().trim().min(5).max(10),
};

export async function createCustomerAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const data = z
    .object({
      name: z.string().trim().min(2),
      ...customerAddressFields,
    })
    .parse(Object.fromEntries(formData));
  const accountNumber = `CUST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name: data.name,
        accountNumber,
        organizationId: user.organizationId,
      },
    });
    const building = await tx.building.create({
      data: {
        customerId: customer.id,
        buildingName: data.name,
        streetAddress: data.streetAddress,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state.toUpperCase(),
        postalCode: data.postalCode,
        routeZone: `${data.city}, ${data.state.toUpperCase()}`,
      },
    });
    await tx.auditLog.createMany({
      data: [
        {
          entityType: "Customer",
          entityId: customer.id,
          action: "CREATED",
          reason: "Customer onboarding step 1",
          changedById: user.id,
          newValue: { name: data.name, accountNumber },
        },
        {
          entityType: "Building",
          entityId: building.id,
          action: "CREATED",
          reason: "Customer address created during onboarding",
          changedById: user.id,
          newValue: {
            streetAddress: data.streetAddress,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            state: data.state.toUpperCase(),
            postalCode: data.postalCode,
          },
        },
      ],
    });
    return { customer, building };
  });
  revalidatePath("/customers");
  redirect(
    `/customers/${result.customer.id}/towers/new?buildingId=${result.building.id}`,
  );
}

export async function addCustomerAddressAction(formData: FormData) {
  const user = await requireRole([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SCHEDULER,
  ]);
  const data = z
    .object({
      customerId: z.string().min(1),
      ...customerAddressFields,
    })
    .parse(Object.fromEntries(formData));
  const customer = await db.customer.findFirstOrThrow({
    where: {
      id: data.customerId,
      organizationId: user.organizationId,
      active: true,
      buildings: { none: {} },
    },
    select: { id: true, name: true },
  });
  const state = data.state.toUpperCase();
  const building = await db.$transaction(async (tx) => {
    const created = await tx.building.create({
      data: {
        customerId: customer.id,
        buildingName: customer.name,
        streetAddress: data.streetAddress,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state,
        postalCode: data.postalCode,
        routeZone: `${data.city}, ${state}`,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Building",
        entityId: created.id,
        action: "CREATED",
        reason: "Added missing customer address",
        changedById: user.id,
        newValue: {
          customerId: customer.id,
          streetAddress: data.streetAddress,
          addressLine2: data.addressLine2 || null,
          city: data.city,
          state,
          postalCode: data.postalCode,
        },
      },
    });
    return created;
  });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}/towers/new?buildingId=${building.id}`);
}
