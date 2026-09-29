import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  clearLoginFailures,
  loginAccountAttemptKey,
  loginAttemptKey,
  loginBlocked,
  recordLoginFailure,
} from "@/lib/login-rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
});

const DUMMY_PASSWORD_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6D9EMkRZl9QEqbIum9RO3Mx4VnWvJ6W";

function relativeRedirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { location },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return relativeRedirect("/login?error=1");
  const clientIp = request.headers.get("x-real-ip")?.trim() || "unknown";
  const attemptKeys = [
    loginAccountAttemptKey(parsed.data.email),
    loginAttemptKey(parsed.data.email, clientIp),
  ];
  if (attemptKeys.some((key) => loginBlocked(key)))
    return relativeRedirect("/login?error=rate-limited");
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  const validPassword = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !user.active || !validPassword) {
    const blocked = attemptKeys.some((key) => recordLoginFailure(key));
    if (blocked) return relativeRedirect("/login?error=rate-limited");
    return relativeRedirect("/login?error=1");
  }
  attemptKeys.forEach(clearLoginFailures);
  await createSession(user);
  return relativeRedirect("/");
}
