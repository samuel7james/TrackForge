import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { VIEWER_ID_COOKIE } from "@/lib/anonymous-id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Server Components can read cookies but never set them (only Route Handlers
// and Server Actions can) -- the public track page needs to read viewerId to
// know "has this browser already liked this track" on first render, so it
// must already exist by the time that render happens. This proxy (Next.js
// 16's renamed "middleware") runs before every request and can set cookies
// on the response, closing that gap.
export function proxy(request: NextRequest) {
  if (request.cookies.has(VIEWER_ID_COOKIE)) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(VIEWER_ID_COOKIE, randomUUID(), {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
