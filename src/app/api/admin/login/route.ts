import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminCredentials, createAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitKey } from "@/lib/client-ip";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PER_ORIGIN_MAX = 5; // brute-force deterrent against one attacker
// Deliberately looser than the per-origin budget: it exists only to bound a
// distributed attempt, not to be the limit a real person meets.
const GLOBAL_MAX = 30;

export async function POST(request: Request) {
  // Two budgets, not one. A single global key was enough to brute-force
  // against, but it also meant anyone could spend all 5 attempts a minute
  // from anywhere and lock the real admin out of their own dashboard
  // indefinitely -- a trivial denial of service. The per-origin budget is
  // what an attacker actually runs into; the global one is a much higher
  // ceiling that only a distributed attempt would reach.
  const perOrigin = rateLimitKey(request, "admin-login", "shared");
  if (
    !checkRateLimit(perOrigin, RATE_LIMIT_WINDOW_MS, PER_ORIGIN_MAX) ||
    !checkRateLimit("admin-login:global", RATE_LIMIT_WINDOW_MS, GLOBAL_MAX)
  ) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  let token: string;
  let maxAge: number;
  try {
    ({ token, maxAge } = createAdminSessionToken());
  } catch {
    // ADMIN_SESSION_SECRET missing in this environment -- a clear error
    // instead of an unhandled 500, since the credentials themselves were
    // actually correct.
    return NextResponse.json(
      { error: "Server isn't configured for admin login yet (missing ADMIN_SESSION_SECRET)" },
      { status: 500 }
    );
  }
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return NextResponse.json({ ok: true });
}
