import { spawnSync } from "node:child_process";

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl)
  throw new Error("Set E2E_DATABASE_URL to a dedicated test database.");

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
if (!/(^|[_-])(test|e2e)([_-]|$)/i.test(databaseName))
  throw new Error(
    `Refusing to reset database "${databaseName}". Its name must contain a standalone test or e2e marker.`,
  );

const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  E2E_TEST_MODE: "true",
  DEMO_MODE: "true",
};

for (const command of [
  ["prisma", "migrate", "reset", "--force", "--skip-seed"],
  ["tsx", "prisma/seed.ts"],
]) {
  const result = spawnSync("npx", command, {
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Prepared isolated E2E database: ${databaseName}`);
