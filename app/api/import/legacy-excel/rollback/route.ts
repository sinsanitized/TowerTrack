import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { rollbackLegacyImport } from "@/lib/legacy-import/service";

export async function POST(request: Request) {
  const user = await requireRole([UserRole.ADMIN]);
  const parsed = z
    .object({ batchId: z.string().min(1) })
    .safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: "Batch ID is required." }, { status: 400 });
  try {
    return Response.json(await rollbackLegacyImport({ ...parsed.data, user }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Rollback failed." },
      { status: 400 },
    );
  }
}
