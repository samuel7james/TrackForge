import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Deleting a claimed player identity is global (a DisplayName row isn't
// scoped to any one track), so unlike lap times this stays admin-only --
// no track owner action for this, even on their own track. Cascades every
// other row this viewerId/name touches site-wide: lap records, likes
// (decrementing each liked track's denormalized likeCount to match), and
// comments posted under this claimed name (Comment has no viewerId column
// -- see schema.prisma -- so the name is the only link, the same staleness
// trade-off the schema already accepts for it). Tracks themselves are
// untouched: authorship is a wholly separate anonymous cookie (authorId)
// with no stored link to viewerId, so a track's creator can't be
// conflated with this player identity.
export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const player = await prisma.displayName.findUnique({ where: { id } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const likes = await prisma.like.findMany({
    where: { viewerId: player.viewerId },
    select: { trackId: true },
  });

  await prisma.$transaction([
    ...likes.map((like) =>
      prisma.track.update({
        where: { id: like.trackId },
        data: { likeCount: { decrement: 1 } },
      })
    ),
    prisma.like.deleteMany({ where: { viewerId: player.viewerId } }),
    prisma.lapRecord.deleteMany({ where: { viewerId: player.viewerId } }),
    prisma.comment.deleteMany({ where: { displayName: player.name } }),
    prisma.displayName.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
