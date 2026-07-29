import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { createLapSessionToken } from "@/lib/lap-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitKey } from "@/lib/client-ip";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

// Opens a race session: the engine calls this as it starts up, and hands
// the token back with any lap time it later submits. The token carries the
// server's own timestamp, which is what lets the submission route tell a
// lap that took real time from one that was posted instantly.
//
// Deliberately cheap and side-effect free -- it writes nothing, so handing
// one out to a caller who never races costs a signature and nothing else.
export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const viewerId = await getOrCreateAnonymousId(VIEWER_ID_COOKIE);

  if (!checkRateLimit(rateLimitKey(request, "lap-session", viewerId), RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  try {
    return NextResponse.json({ token: createLapSessionToken(slug, viewerId) });
  } catch {
    // ADMIN_SESSION_SECRET missing -- see lap-session.ts. Surfaced rather
    // than 500'd, and the submission route fails closed on its own.
    return NextResponse.json({ error: "Server isn't configured for lap sessions" }, { status: 500 });
  }
}
