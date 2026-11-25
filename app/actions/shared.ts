import { db } from "@/lib/db";

export async function scopedSystem(systemId: string, organizationId: string) {
  return db.coolingTowerSystem.findFirstOrThrow({
    where: {
      id: systemId,
      active: true,
      building: { customer: { organizationId } },
    },
    include: { ruleProfile: true },
  });
}
