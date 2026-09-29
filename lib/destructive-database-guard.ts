const SAFE_DATABASE_MARKER = /(^|[_-])(test|e2e)([_-]|$)/i;

export function databaseName(databaseUrl: string) {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, "");
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL before seeding.",
    );
  }
}

export function assertDestructiveSeedAllowed(
  environment: Record<string, string | undefined> = process.env,
) {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required before destructive seeding.");

  const name = databaseName(databaseUrl);
  const isolatedTestDatabase = SAFE_DATABASE_MARKER.test(name);
  const confirmedEmptyDatabase = environment.SEED_CONFIRMED_EMPTY === "true";
  const explicitOperatorApproval =
    environment.ALLOW_DESTRUCTIVE_SEED === "true";

  if (
    !isolatedTestDatabase &&
    !confirmedEmptyDatabase &&
    !explicitOperatorApproval
  )
    throw new Error(
      `Refusing to erase and reseed database "${name}". Use an isolated test/e2e database, the seed-if-empty workflow, or explicitly set ALLOW_DESTRUCTIVE_SEED=true.`,
    );

  return name;
}
