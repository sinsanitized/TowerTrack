import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  clearLoginFailures,
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
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const clientIp = forwardedFor?.trim() || "unknown";
  const attemptKey = loginAttemptKey(parsed.data.email, clientIp);
  if (loginBlocked(attemptKey))
    return relativeRedirect("/login?error=rate-limited");
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  const validPassword = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !user.active || !validPassword) {
    const blocked = recordLoginFailure(attemptKey);
    if (blocked) return relativeRedirect("/login?error=rate-limited");
    return relativeRedirect("/login?error=1");
  }
  clearLoginFailures(attemptKey);
  await createSession(user);
  return relativeRedirect("/");
}
