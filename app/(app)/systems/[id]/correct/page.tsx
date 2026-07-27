import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CorrectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const event = await db.serviceEvent.findFirst({
    where: {
      coolingTowerSystemId: id,
      eventType: "ROUTINE_LEGIONELLA_SAMPLE_COLLECTED",
      status: "ACTIVE",
      coolingTowerSystem: {
        building: { customer: { organizationId: user.organizationId } },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!event) notFound();
  redirect(`/systems/${id}/events/${event.id}`);
}
