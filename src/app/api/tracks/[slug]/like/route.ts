import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20; // 20 toggles per viewerId per minute -- generous, this is a courtesy limit against scripted spam, not real usage

// Toggle, not set/unset -- the client always POSTs here and the server
// decides add-or-remove based on whether a Like row already exists for this
// (track, viewerId) pair. No login (§8): viewerId is a cookie, not an
// account, so "one like per browser" is the whole guarantee -- clearing
// cookies resets it, same trade-off already accepted for authorId/editToken.
export async function POST(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const viewerId = await getOrCreateAnonymousId(VIEWER_ID_COOKIE);
  if (!checkRateLimit(`like:${viewerId}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const existing = await prisma.like.findUnique({
    where: { trackId_viewerId: { trackId: track.id, viewerId } },
  });

  const [, updated] = await prisma.$transaction(
    existing
      ? [
          prisma.like.delete({ where: { id: existing.id } }),
          prisma.track.update({
            where: { id: track.id },
            data: { likeCount: { decrement: 1 } },
          }),
        ]
      : [
          prisma.like.create({ data: { trackId: track.id, viewerId } }),
          prisma.track.update({
            where: { id: track.id },
            data: { likeCount: { increment: 1 } },
          }),
        ]
  );

  return NextResponse.json({ liked: !existing, likeCount: updated.likeCount });
}
