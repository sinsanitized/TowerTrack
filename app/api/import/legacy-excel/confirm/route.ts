import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { confirmLegacyImport } from "@/lib/legacy-import/service";

export async function POST(request: Request) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({
      batchId: z.string().min(1),
      selectedRowIds: z.array(z.string().min(1)).min(1),
    })
    .safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Select at least one eligible row." },
      { status: 400 },
    );
  try {
    return Response.json(await confirmLegacyImport({ ...parsed.data, user }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 400 },
    );
  }
}
