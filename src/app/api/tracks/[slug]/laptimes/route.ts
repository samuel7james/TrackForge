import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20; // one submission per completed lap -- generous, a courtesy limit against scripted spam, same shape as like/route.ts

// Only ever called from a "real play" session (track-editor.tsx passes
// submitLapTimes={autoplay}, the same flag that already gates the
// playCount POST) -- an owner testing their own track in the editor never
// hits this, so they can't inflate their own leaderboard position. One row
// per (track, viewer) = that viewer's personal best; only written if none
// exists yet or the new time is faster -- a manual read-then-write, not a
// blind upsert, since "only update if better" isn't expressible as one.
export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const viewerId = await getOrCreateAnonymousId(VIEWER_ID_COOKIE);
  if (!checkRateLimit(`laptimes:${viewerId}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const timeMs = body?.timeMs;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 40) : "";
  if (!Number.isFinite(timeMs) || timeMs <= 0 || !displayName) {
    return NextResponse.json({ error: "Invalid lap time submission" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const existing = await prisma.lapRecord.findUnique({
    where: { trackId_viewerId: { trackId: track.id, viewerId } },
  });

  let isNewPersonalBest = false;
  if (!existing) {
    isNewPersonalBest = true;
    await prisma.lapRecord.create({
      data: { trackId: track.id, viewerId, displayName, timeMs: Math.round(timeMs) },
    });
  } else if (timeMs < existing.timeMs) {
    isNewPersonalBest = true;
    await prisma.lapRecord.update({
      where: { id: existing.id },
      data: { displayName, timeMs: Math.round(timeMs) },
    });
  }

  const personalBestMs = isNewPersonalBest ? Math.round(timeMs) : existing!.timeMs;
  const worldRecord = await prisma.lapRecord.aggregate({
    where: { trackId: track.id },
    _min: { timeMs: true },
  });

  return NextResponse.json({
    isNewPersonalBest,
    personalBestMs,
    worldRecordMs: worldRecord._min.timeMs ?? personalBestMs,
  });
}
