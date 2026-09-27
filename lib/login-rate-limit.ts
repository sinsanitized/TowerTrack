const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Attempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};
const attempts = new Map<string, Attempt>();

export function loginAttemptKey(email: string, ip: string) {
  return `${email.trim().toLowerCase()}|${ip}`;
}

export function loginBlocked(key: string, now = Date.now()) {
  const attempt = attempts.get(key);
  if (!attempt) return false;
  if (attempt.blockedUntil > now) return true;
  if (now - attempt.windowStartedAt >= WINDOW_MS) attempts.delete(key);
  return false;
}

export function recordLoginFailure(key: string, now = Date.now()) {
  const previous = attempts.get(key);
  const attempt =
    !previous || now - previous.windowStartedAt >= WINDOW_MS
      ? { failures: 0, windowStartedAt: now, blockedUntil: 0 }
      : previous;
  attempt.failures += 1;
  if (attempt.failures >= MAX_FAILURES) attempt.blockedUntil = now + WINDOW_MS;
  attempts.set(key, attempt);
  return attempt.blockedUntil > now;
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

export function resetLoginRateLimitForTests() {
  attempts.clear();
}
