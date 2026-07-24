import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// Track owners can remove a lap time from their own track's leaderboard
// (e.g. an obviously spoofed/cheated entry) -- the same editToken-gated
// pattern as publish/delete-track, but this is the one moderation power
// that's scoped to *content on their track* rather than the track row
// itself. Regular racers never get this: there's no route reachable
// without the owner's editToken, and the leaderboard UI only ever shows
// a delete control to whichever browser holds it. Deleting a player's
// claimed name entirely (DisplayName) stays admin-only -- that's a
// global identity, not something scoped to one track.
export async function DELETE(request: Request, { params }: RouteContext) {
  const { slug, id } = await params;
  const editToken = request.headers.get("x-edit-token");
  if (!editToken) {
    return NextResponse.json({ error: "Missing edit token" }, { status: 401 });
  }

  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true, editToken: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.editToken !== editToken) {
    return NextResponse.json({ error: "Invalid edit token" }, { status: 403 });
  }

  const lapRecord = await prisma.lapRecord.findUnique({ where: { id }, select: { id: true, trackId: true } });
  if (!lapRecord || lapRecord.trackId !== track.id) {
    return NextResponse.json({ error: "Lap time not found" }, { status: 404 });
  }

  await prisma.lapRecord.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
