import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { VIEWER_ID_COOKIE } from "@/lib/anonymous-id";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const TOP_N = 20;

// Vercel's default for a route handler is `public, max-age=0,
// must-revalidate`, which is wrong for this response twice over. It's
// personalised -- `own` and `isViewer` are derived from the caller's own
// viewerId cookie -- so `public` would let a shared cache hand one
// visitor's standings to another. And it's moderated data: an admin
// deleting a lap time has to be visible on the very next read, not after
// a revalidation some intermediary may or may not perform.
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

// Public read, no auth (mirrors GET /api/tracks/[slug]) -- ranks aren't a
// secret. Returns the top N entries plus, if this request's own viewerId
// cookie has a row, that viewer's own rank/entry even when it falls outside
// the top N (so "you're #47" is still visible, not just silently omitted).
export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404, headers: NO_STORE });
  }

  const topEntries = await prisma.lapRecord.findMany({
    where: { trackId: track.id },
    orderBy: { timeMs: "asc" },
    take: TOP_N,
    select: { displayName: true, timeMs: true, viewerId: true },
  });

  const viewerId = (await cookies()).get(VIEWER_ID_COOKIE)?.value ?? "";
  const ownEntry = topEntries.find((e) => e.viewerId === viewerId);

  let own: { rank: number; displayName: string; timeMs: number } | null = null;
  if (viewerId && !ownEntry) {
    const mine = await prisma.lapRecord.findUnique({
      where: { trackId_viewerId: { trackId: track.id, viewerId } },
      select: { displayName: true, timeMs: true },
    });
    if (mine) {
      const rank = await prisma.lapRecord.count({
        where: { trackId: track.id, timeMs: { lt: mine.timeMs } },
      });
      own = { rank: rank + 1, displayName: mine.displayName, timeMs: mine.timeMs };
    }
  }

  return NextResponse.json(
    {
      entries: topEntries.map(({ displayName, timeMs }, i) => ({
        rank: i + 1,
        displayName,
        timeMs,
        isViewer: topEntries[i].viewerId === viewerId,
      })),
      own,
    },
    { headers: NO_STORE }
  );
}
