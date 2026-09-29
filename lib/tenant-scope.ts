import type { Prisma } from "@prisma/client";

export function accessibleRuleProfileWhere(
  organizationId: string,
): Prisma.RuleProfileWhereInput {
  return {
    OR: [{ organizationId: null }, { organizationId }],
  };
}

export function organizationSystemWhere(
  organizationId: string,
): Prisma.CoolingTowerSystemWhereInput {
  return {
    building: { customer: { organizationId } },
  };
}
