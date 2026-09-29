import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { previewSystemCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { todayInTimeZone } from "@/lib/date";
import {
  accessibleRuleProfileWhere,
  organizationSystemWhere,
} from "@/lib/tenant-scope";
export async function POST(request: Request) {
  const user = await requireRole([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]);
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File))
    return Response.json({ error: "CSV file is required" }, { status: 400 });
  if (file.size > 2_000_000)
    return Response.json(
      { error: "CSV files must be 2 MB or smaller" },
      { status: 413 },
    );
  const preview = previewSystemCsv(await file.text(), todayInTimeZone());
  const profileIds = [...new Set(preview.rows.map((r) => r.rule_profile_id))];
  const profiles = await db.ruleProfile.findMany({
    where: {
      id: { in: profileIds },
      ...accessibleRuleProfileWhere(user.organizationId),
    },
    select: { id: true },
  });
  const known = new Set(profiles.map((p) => p.id));
  preview.rows.forEach((r, i) => {
    if (!known.has(r.rule_profile_id))
      preview.errors.push({
        row: i + 2,
        message: `Unknown rule profile: ${r.rule_profile_id}`,
      });
  });
  const existing = await db.coolingTowerSystem.findMany({
    where: {
      internalJobNumber: { in: preview.rows.map((r) => r.job_number) },
      ...organizationSystemWhere(user.organizationId),
    },
    select: { internalJobNumber: true },
  });
  const conflicts = new Set(existing.map((x) => x.internalJobNumber));
  preview.rows.forEach((r, i) => {
    if (conflicts.has(r.job_number)) preview.duplicates.push(i + 2);
  });
  return Response.json({
    ...preview,
    canCommit: preview.errors.length === 0 && preview.duplicates.length === 0,
    note: "Validated preview only. Review rows before committing through the administrative workflow.",
  });
}
