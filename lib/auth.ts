import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

const DEVELOPMENT_SECRET = "dev-only-change-this-secret-please-1234";

function sessionSecret() {
  const secret = process.env.AUTH_SECRET || DEVELOPMENT_SECRET;
  const demoMode = process.env.DEMO_MODE === "true";
  if (
    process.env.NODE_ENV === "production" &&
    !demoMode &&
    (secret === DEVELOPMENT_SECRET || secret.length < 32)
  )
    throw new Error(
      "AUTH_SECRET must be set to a unique value of at least 32 characters.",
    );
  return secret;
}

const key = () => new TextEncoder().encode(sessionSecret());
const COOKIE = "towertrack_session";

export async function createSession(user: { id: string; role: UserRole }) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 43_200,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub) return null;
    return db.user.findFirst({
      where: { id: payload.sub, active: true },
      select: {
        id: true,
        organizationId: true,
        name: true,
        email: true,
        role: true,
      },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireRole(allowed: UserRole[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role))
    throw new Error("You do not have permission to perform this action.");
  return user;
}
