import { request, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("Playwright requires a base URL.");
  const client = await request.newContext({ baseURL });
  try {
    const response = await client.get("/api/health");
    const health = response.ok() ? await response.json() : null;
    if (health?.testMode !== true)
      throw new Error(
        "E2E refused: the target server is not running with E2E_TEST_MODE=true. Use a dedicated test database; never run browser tests against development or production data.",
      );
  } finally {
    await client.dispose();
  }
}
