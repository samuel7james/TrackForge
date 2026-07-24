import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// A single hardcoded operator identity (env vars only, never a database
// row) -- deliberately separate from the anonymous no-accounts model the
// rest of the app uses (viewerId/authorId cookies, editToken per track).
// Credentials are the user's own choice, set via ADMIN_USERNAME/
// ADMIN_PASSWORD; never hardcoded here.
export const ADMIN_SESSION_COOKIE = "trackforge-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 1 week

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on mismatched lengths rather than returning
  // false, so the length check has to happen first -- it leaks length,
  // not content, an accepted trade-off for this standard pattern.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedUsername || !expectedPassword) return false;
  return (
    timingSafeStringEqual(username, expectedUsername) &&
    timingSafeStringEqual(password, expectedPassword)
  );
}

function sign(value: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

// Not a JWT -- a session cookie value is just `<expiryTimestamp>.<hmac>`.
// One hardcoded admin identity needs no claims/subject, just "is this
// request holding a signature only the server's own secret could have
// produced, and has it not expired yet."
export function createAdminSessionToken(): { token: string; maxAge: number } {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_MAX_AGE_SECONDS };
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const separatorIndex = token.indexOf(".");
  if (separatorIndex === -1) return false;
  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!payload || !signature) return false;
  if (!timingSafeStringEqual(signature, sign(payload))) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

// Route Handlers aren't covered by the (dashboard) layout's redirect --
// that only guards page rendering -- so every /api/admin/* action route
// calls this itself before doing anything.
export async function isAdminSessionValid(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}
