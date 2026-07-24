import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_BODY_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5; // 5 comments per viewerId per 10 minutes

// Freeform display name instead of an account (§8) -- no login, so no
// identity to check beyond "not empty, not absurdly long," plus a rate limit
// keyed by viewerId (the cookie exists for likes already; reused here purely
// as a rate-limit key, never stored on the comment itself).
export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const viewerId = await getOrCreateAnonymousId(VIEWER_ID_COOKIE);
  if (!checkRateLimit(`comment:${viewerId}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json(
      { error: "Too many comments — try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);

  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json({ error: "Name must be 1-40 characters" }, { status: 400 });
  }
  if (!text || text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: "Comment must be 1-500 characters" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { trackId: track.id, displayName, body: text },
  });

  return NextResponse.json({
    id: comment.id,
    displayName: comment.displayName,
    body: comment.body,
    createdAt: comment.createdAt,
  });
}
