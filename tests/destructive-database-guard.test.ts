import { describe, expect, it } from "vitest";
import {
  assertDestructiveSeedAllowed,
  databaseName,
} from "@/lib/destructive-database-guard";

describe("destructive database guard", () => {
  it("refuses an ordinary database without explicit approval", () => {
    expect(() =>
      assertDestructiveSeedAllowed({
        DATABASE_URL: "postgresql://user:pass@db.example/towertrack",
      }),
    ).toThrow(/Refusing to erase and reseed database "towertrack"/);
  });

  it.each(["towertrack_test", "towertrack-e2e", "e2e"])(
    "allows isolated database %s",
    (name) => {
      expect(
        assertDestructiveSeedAllowed({
          DATABASE_URL: `postgresql://user:pass@localhost/${name}`,
        }),
      ).toBe(name);
    },
  );

  it("allows a database verified empty by the safe bootstrap workflow", () => {
    expect(
      assertDestructiveSeedAllowed({
        DATABASE_URL: "postgresql://user:pass@db/towertrack",
        SEED_CONFIRMED_EMPTY: "true",
      }),
    ).toBe("towertrack");
  });

  it("requires exact approval values", () => {
    expect(() =>
      assertDestructiveSeedAllowed({
        DATABASE_URL: "postgresql://user:pass@db/towertrack",
        ALLOW_DESTRUCTIVE_SEED: "yes",
      }),
    ).toThrow(/Refusing/);
  });

  it("parses percent-encoded database URLs without exposing credentials", () => {
    expect(
      databaseName("postgresql://user:p%40ss@localhost/towertrack_test"),
    ).toBe("towertrack_test");
  });
});
