import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ComplianceDate } from "@/components/compliance-date";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatLegionellaResult, plainEnumLabel } from "@/lib/labels";
import { buttonClass } from "@/lib/button-variants";

export default async function SamplesPage() {
  const user = await requireUser();
  const samples = await db.serviceEvent.findMany({
    where: {
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      status: "ACTIVE",
      coolingTowerSystem: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      coolingTowerSystem: { include: { building: true } },
      labResultsForSample: { orderBy: { receivedDate: "desc" }, take: 1 },
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Field and laboratory records"
        title="Samples"
        description="Legionella collections and their most recent linked result."
      />
      <div className="panel divide-y divide-slate-200">
        {samples.map((sample) => {
          const result = sample.labResultsForSample[0];
          return (
            <article
              key={sample.id}
              className="grid gap-3 p-5 md:grid-cols-[1fr_180px_180px_auto] md:items-center"
            >
              <div>
                <div className="font-black">
                  {sample.coolingTowerSystem.systemName}
                </div>
                <div className="text-sm text-slate-600">
                  {sample.coolingTowerSystem.building.buildingName}
                </div>
              </div>
              <ComplianceDate
                value={sample.eventDate}
                label="Sample collected"
                compact
              />
              <div>
                <div className="label">Laboratory result</div>
                <div className="mt-1 font-black">
                  {result
                    ? formatLegionellaResult(result.cfuPerMl)
                    : "No result entered"}
                </div>
                {result && (
                  <div className="text-xs text-slate-600">
                    {plainEnumLabel(result.level)}
                  </div>
                )}
              </div>
              <Link
                className={buttonClass(
                  result ? "secondary" : "primary",
                  "min-h-11 justify-center",
                )}
                href={`/systems/${sample.coolingTowerSystemId}?sampleEventId=${sample.id}`}
              >
                {result ? "Open tower" : "Add result"}
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
