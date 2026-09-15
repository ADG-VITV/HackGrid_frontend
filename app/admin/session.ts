import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "hackgrid_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

type AdminSession = { id: number; name: string; expiresAt: number };

function sessionSecret() {
  // ADMIN_API_KEY is a safe compatibility fallback for existing deployments;
  // ADMIN_SESSION_SECRET can be set separately to rotate browser sessions.
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY || null;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const secret = sessionSecret();
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!secret || !value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!Number.isInteger(session.id) || !session.name || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireAdminSession() {
  if (!(await getAdminSession())) throw new Error("Admin sign-in required.");
}

export async function createAdminSession(admin: { id: number; name: string }) {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET or ADMIN_API_KEY is not configured.");

  const session: AdminSession = { ...admin, expiresAt: Date.now() + SESSION_SECONDS * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload, secret)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: SESSION_SECONDS,
  });
}
