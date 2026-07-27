import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const [state] = await db.$queryRaw<
    Array<{ appTable: string | null; migrationsTable: string | null }>
  >`SELECT
      to_regclass('"Building"')::text AS "appTable",
      to_regclass('"_prisma_migrations"')::text AS "migrationsTable"`;
  await db.$disconnect();

  // Exit 10 means this database predates checked-in migrations and must be
  // baselined. Empty databases and already-managed databases need no action.
  if (state?.appTable && !state.migrationsTable) process.exit(10);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
