"use server";

import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

const manageableUserRoles = [
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SCHEDULER,
  UserRole.TECHNICIAN,
  UserRole.READ_ONLY,
] as const;

export async function createUserAction(formData: FormData) {
  const administrator = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(12).max(1024),
      role: z.enum(manageableUserRoles),
    })
    .parse(Object.fromEntries(formData));

  const existing = await db.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });
  if (existing)
    throw new Error("A user with that email address already exists.");

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const created = await db.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        organizationId: administrator.organizationId,
        name: parsed.name,
        email: parsed.email,
        passwordHash,
        role: parsed.role,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "User",
        entityId: account.id,
        action: "CREATED",
        reason: "Administrator created a user account",
        changedById: administrator.id,
        newValue: {
          name: account.name,
          email: account.email,
          role: account.role,
          active: account.active,
        },
      },
    });
    return account;
  });

  revalidatePath("/admin");
  redirect(`/admin?userSaved=${created.id}&userAction=created`);
}

export async function updateUserRoleAction(formData: FormData) {
  const administrator = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      userId: z.string().min(1),
      role: z.enum(manageableUserRoles),
    })
    .parse(Object.fromEntries(formData));

  await db.$transaction(async (tx) => {
    const account = await tx.user.findFirstOrThrow({
      where: {
        id: parsed.userId,
        organizationId: administrator.organizationId,
      },
    });
    if (account.role === parsed.role) return;
    if (account.id === administrator.id && parsed.role !== UserRole.ADMIN)
      throw new Error("You cannot remove your own administrator role.");
    if (
      account.active &&
      account.role === UserRole.ADMIN &&
      parsed.role !== UserRole.ADMIN
    ) {
      const activeAdministrators = await tx.user.count({
        where: {
          organizationId: administrator.organizationId,
          role: UserRole.ADMIN,
          active: true,
        },
      });
      if (activeAdministrators <= 1)
        throw new Error(
          "Assign another active administrator before changing this role.",
        );
    }
    await tx.user.update({
      where: { id: account.id },
      data: { role: parsed.role },
    });
    await tx.auditLog.create({
      data: {
        entityType: "User",
        entityId: account.id,
        action: "ROLE_CHANGED",
        reason: "Administrator changed a user role",
        changedById: administrator.id,
        previousValue: { role: account.role },
        newValue: { role: parsed.role },
      },
    });
  });

  revalidatePath("/admin");
  redirect(`/admin?userSaved=${parsed.userId}&userAction=role`);
}

export async function setUserActiveAction(formData: FormData) {
  const administrator = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      userId: z.string().min(1),
      active: z.enum(["true", "false"]).transform((value) => value === "true"),
    })
    .parse(Object.fromEntries(formData));

  await db.$transaction(async (tx) => {
    const account = await tx.user.findFirstOrThrow({
      where: {
        id: parsed.userId,
        organizationId: administrator.organizationId,
      },
    });
    if (account.active === parsed.active) return;
    if (account.id === administrator.id && !parsed.active)
      throw new Error("You cannot disable your own account.");
    if (account.role === UserRole.ADMIN && account.active && !parsed.active) {
      const activeAdministrators = await tx.user.count({
        where: {
          organizationId: administrator.organizationId,
          role: UserRole.ADMIN,
          active: true,
        },
      });
      if (activeAdministrators <= 1)
        throw new Error(
          "Create another active administrator before disabling this account.",
        );
    }
    await tx.user.update({
      where: { id: account.id },
      data: { active: parsed.active },
    });
    await tx.auditLog.create({
      data: {
        entityType: "User",
        entityId: account.id,
        action: parsed.active ? "REACTIVATED" : "DISABLED",
        reason: parsed.active
          ? "Administrator reactivated a user account"
          : "Administrator disabled a user account",
        changedById: administrator.id,
        previousValue: { active: account.active },
        newValue: { active: parsed.active },
      },
    });
  });

  revalidatePath("/admin");
  redirect(
    `/admin?userSaved=${parsed.userId}&userAction=${parsed.active ? "reactivated" : "disabled"}`,
  );
}
