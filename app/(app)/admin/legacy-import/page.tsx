import { UserRole } from "@prisma/client";
import { LegacyImportWorkflow } from "@/components/legacy-import-workflow";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function LegacyImportPage() {
  await requireRole([UserRole.ADMIN]);
  const [jurisdictions, profiles] = await Promise.all([
    db.jurisdiction.findMany({ orderBy: [{ state: "asc" }, { city: "asc" }] }),
    db.ruleProfile.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Legacy Excel import"
        description="Preview the workbook first. Nothing is imported until you review and confirm it."
      />
      <LegacyImportWorkflow
        jurisdictions={jurisdictions.map((item) => ({
          id: item.id,
          label: [item.city, item.county, item.state]
            .filter(Boolean)
            .join(", "),
        }))}
        profiles={profiles.map((item) => ({
          id: item.id,
          name: item.name,
          jurisdictionId: item.jurisdictionId,
        }))}
      />
    </>
  );
}
