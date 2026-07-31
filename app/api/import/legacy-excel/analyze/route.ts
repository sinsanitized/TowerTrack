import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { previewLegacyImport } from "@/lib/legacy-import/service";

const defaultsSchema = z.object({
  jurisdictionId: z.string().min(1),
  ruleProfileId: z.string().min(1),
  city: z.string().trim().min(2),
  state: z.string().trim().length(2),
  postalCode: z.union([z.literal(""), z.string().trim().min(5).max(10)]),
  routeZone: z.string().trim().min(2),
});

export async function POST(request: Request) {
  const user = await requireRole([UserRole.ADMIN]);
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File))
    return Response.json(
      { error: "Choose an Excel workbook." },
      { status: 400 },
    );
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    return Response.json(
      { error: "Only .xlsx workbooks are supported." },
      { status: 415 },
    );
  if (file.size > 10_000_000)
    return Response.json(
      { error: "Workbook must be 10 MB or smaller." },
      { status: 413 },
    );
  const parsed = defaultsSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success)
    return Response.json(
      { error: "Complete the import defaults." },
      { status: 400 },
    );
  try {
    return Response.json(
      await previewLegacyImport({
        buffer: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        user,
        defaults: parsed.data,
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Workbook analysis failed.",
      },
      { status: 400 },
    );
  }
}
