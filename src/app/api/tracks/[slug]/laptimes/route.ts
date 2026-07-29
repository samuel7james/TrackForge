import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { isSameOriginRequest } from "@/lib/same-origin";
import { verifyLapSessionToken, isElapsedConsistent } from "@/lib/lap-session";
import { minimumPlausibleLapTimeMs } from "@/modules/track-format/lap-time-bounds";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20; // one submission per completed lap -- generous, a courtesy limit against scripted spam, same shape as like/route.ts
/** An hour. Nothing legitimate approaches this; it exists so the column
 * can't be stuffed with an absurd sentinel value. */
const MAX_TIME_MS = 60 * 60 * 1000;

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

  // Outermost and weakest check -- see same-origin.ts on exactly how little
  // this proves. It costs a forged request one header, but it's free here
  // and turns away anything pointed at the endpoint without thought.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Lap times can only be submitted from the game" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const timeMs = body?.timeMs;
  // Integer and bounded, where before any positive finite number was taken
  // -- 0.0001 and 1e308 both used to be storable.
  if (!Number.isFinite(timeMs) || !Number.isInteger(timeMs) || timeMs <= 0 || timeMs > MAX_TIME_MS) {
    return NextResponse.json({ error: "Invalid lap time submission" }, { status: 400 });
  }

  // The race has to have been opened before the lap could have finished.
  // The token is stamped and signed by the server, so both timestamps come
  // from the same clock and a client can't move either of them.
  const session = verifyLapSessionToken(
    typeof body?.sessionToken === "string" ? body.sessionToken : null,
    slug,
    viewerId
  );
  if (!session.ok) {
    return NextResponse.json(
      { error: "Start the race from the track page before submitting a time", code: "NO_LAP_SESSION" },
      { status: 403 }
    );
  }
  if (!isElapsedConsistent(timeMs, session.elapsedMs)) {
    return NextResponse.json(
      { error: "Lap time is longer than the race has been running" },
      { status: 422 }
    );
  }

  // The authoritative name for this viewer, not whatever the client sent --
  // DisplayNameGate claims a name via /api/display-names/claim before ever
  // letting a race start, so this closes the loophole of a raw POST here
  // attaching a name that isn't actually this viewer's claimed one. No
  // "Anonymous" fallback: a viewer with no active claim (never claimed one,
  // or an admin removed their player row since) gets rejected outright
  // rather than silently recorded under a fake shared identity -- the
  // client treats this code as "clear the stale local name and ask again."
  const claimed = await prisma.displayName.findUnique({ where: { viewerId } });
  if (!claimed) {
    return NextResponse.json(
      { error: "No display name claimed for this browser", code: "NEEDS_DISPLAY_NAME" },
      { status: 401 }
    );
  }
  const displayName = claimed.name;

  const track = await prisma.track.findUnique({
    where: { slug },
    select: { id: true, document: true },
  });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // How fast this particular track could possibly be driven, from its own
  // length (see lap-time-bounds.ts for how the figure was calibrated).
  // This is the check that catches the case this was written for: a 690ms
  // lap posted to a twelve-cell track whose real record was 3.9 seconds.
  //
  // Admins are exempt on purpose. The tuning panel raises top speed well
  // past stock, and laps driven with it are meant to count (the owner's
  // explicit call) -- but a time set that way is indistinguishable from a
  // forged one by duration alone, so the admin session cookie is what
  // separates them. Only the operator holds it.
  const floorMs = minimumPlausibleLapTimeMs(track.document);
  if (floorMs !== null && timeMs < floorMs && !(await isAdminSessionValid())) {
    return NextResponse.json(
      { error: "That lap time isn't possible on this track" },
      { status: 422 }
    );
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
