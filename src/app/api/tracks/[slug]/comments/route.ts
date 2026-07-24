import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const MAX_BODY_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5; // 5 comments per viewerId per 10 minutes

// No accounts (§8), but no anonymous identities either -- a comment's name
// is the same globally-claimed DisplayName racing uses (see
// laptimes/route.ts's identical pattern), never a client-submitted string.
// A viewer with no active claim gets rejected, matching NEEDS_DISPLAY_NAME
// there, rather than letting them post under an unaccountable made-up name.
export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const viewerId = await getOrCreateAnonymousId(VIEWER_ID_COOKIE);
  if (!checkRateLimit(`comment:${viewerId}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json(
      { error: "Too many comments — try again in a few minutes." },
      { status: 429 }
    );
  }

  const claimed = await prisma.displayName.findUnique({ where: { viewerId } });
  if (!claimed) {
    return NextResponse.json(
      { error: "Claim a display name before commenting", code: "NEEDS_DISPLAY_NAME" },
      { status: 401 }
    );
  }
  const displayName = claimed.name;

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";

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
