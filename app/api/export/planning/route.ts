import { planningRows } from "@/lib/queries";
import { requireRole } from "@/lib/auth";
import { csvCell } from "@/lib/csv";
export async function GET() {
  const user = await requireRole([
    "ADMIN",
    "OPERATIONS_MANAGER",
    "SCHEDULER",
    "READ_ONLY",
  ]);
  const rows = await planningRows({ organizationId: user.organizationId });
  const header = [
    "customer",
    "building",
    "system",
    "route_zone",
    "rule_profile",
    "source_authority",
    "last_sample",
    "target_date",
    "hard_due",
    "days_remaining",
    "status",
    "next_action",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.customer,
        r.building,
        r.systemName,
        r.routeZone,
        r.profile,
        r.authority,
        r.lastSample,
        r.targetDate,
        r.hardDueDate,
        r.daysRemaining,
        r.status.label,
        r.status.nextAction,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        "attachment; filename=towertrack-compliance-queue.csv",
    },
  });
}
