import { afterEach, describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  loginAccountAttemptKey,
  loginAttemptKey,
  loginBlocked,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from "@/lib/login-rate-limit";

afterEach(resetLoginRateLimitForTests);

describe("login rate limiting", () => {
  it("blocks the fifth failed attempt for fifteen minutes", () => {
    const key = loginAttemptKey("Admin@Example.com", "127.0.0.1");
    for (let attempt = 1; attempt < 5; attempt += 1)
      expect(recordLoginFailure(key, 1_000)).toBe(false);
    expect(recordLoginFailure(key, 1_000)).toBe(true);
    expect(loginBlocked(key, 1_000 + 14 * 60 * 1_000)).toBe(true);
    expect(loginBlocked(key, 1_000 + 16 * 60 * 1_000)).toBe(false);
  });

  it("clears failures after a successful login", () => {
    const key = loginAttemptKey("admin@example.com", "127.0.0.1");
    recordLoginFailure(key, 1_000);
    clearLoginFailures(key);
    expect(loginBlocked(key, 1_000)).toBe(false);
  });

  it("normalizes account-wide keys so changing IP cannot evade a block", () => {
    expect(loginAccountAttemptKey(" Admin@Example.com ")).toBe(
      "admin@example.com|account",
    );
  });
});
