import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

async function main() {
  const db = new PrismaClient();
  const count = await db.organization.count();
  await db.$disconnect();
  if (count === 0) {
    const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
      stdio: "inherit",
      env: { ...process.env, SEED_CONFIRMED_EMPTY: "true" },
    });
    process.exit(result.status ?? 1);
  }
  console.log("Database already initialized; preserving existing records.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
