import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminCredentials, createAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5; // brute-force deterrent -- there's only one real login attempt pattern to protect

// One fixed rate-limit key (not per-IP/viewerId) -- there's exactly one
// admin identity to attack, so every login attempt against this endpoint
// shares the same budget regardless of source.
export async function POST(request: Request) {
  if (!checkRateLimit("admin-login", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
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
