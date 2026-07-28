import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { computeTrackDifficulty } from "@/modules/track-format/auto-difficulty";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Order-independent -- the editor can rebuild the cells array in a
// different order without the layout actually changing (e.g. re-tiling
// over the same footprint), so this compares the set of placed cells, not
// array position.
function cellsChanged(oldCells: unknown[], newCells: unknown[]): boolean {
  if (oldCells.length !== newCells.length) return true;
  const normalize = (cells: unknown[]) => cells.map((c) => JSON.stringify(c)).sort();
  const a = normalize(oldCells);
  const b = normalize(newCells);
  return a.some((v, i) => v !== b[i]);
}

// Public read — anyone can view a track's current document (also what
// Milestone 3's published track pages will use).
export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: track.id,
    slug: track.slug,
    name: track.name,
    description: track.description,
    document: track.document,
    isPublished: track.isPublished,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
  });
}

// Edit-token guarded — the token is a bearer secret returned once at
// creation and kept client-side (localStorage), never derived from slug/id.
// A valid admin session bypasses the token entirely, so the admin can fix up
// any track (not just their own) without ever holding its editToken.
export async function PATCH(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const isAdmin = await isAdminSessionValid();
  const editToken = request.headers.get("x-edit-token");
  if (!isAdmin && !editToken) {
    return NextResponse.json({ error: "Missing edit token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = safeParseTrackDocument(body?.document);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid track document" }, { status: 400 });
  }
  const difficulty = computeTrackDifficulty(parsed.data.track.cells);
  const document = { ...parsed.data, meta: { ...parsed.data.meta, difficulty } };

  const existing = await prisma.track.findUnique({
    where: { slug },
    select: { id: true, editToken: true, document: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (!isAdmin && existing.editToken !== editToken) {
    return NextResponse.json({ error: "Invalid edit token" }, { status: 403 });
  }

  // A leaderboard reflects laps driven on a specific layout -- once the
  // owner changes the actual tiles, every recorded time (everyone else's,
  // not just the owner's own local best/ghost handled client-side in
  // engine-core.ts) was set on a route that no longer exists, so it's
  // cleared to let a new leaderboard form for the new layout. A rename/
  // description/tag-only save leaves cells untouched and doesn't trigger
  // this at all.
  const oldParsed = safeParseTrackDocument(existing.document);
  const layoutChanged =
    oldParsed.success && cellsChanged(oldParsed.data.track.cells, document.track.cells);

  const [updated] = await prisma.$transaction([
    prisma.track.update({
      where: { slug },
      data: {
        document,
        name: document.meta.name,
        description: document.meta.description,
        tags: document.meta.tags,
        difficulty: document.meta.difficulty,
      },
    }),
    // One row per save (PROJECT_PLAN.md §7) — empty of product features
    // until Milestone 3's version history UI, but capturing the trail from
    // day one avoids a backfill later.
    prisma.trackVersion.create({
      data: { trackId: existing.id, document },
    }),
    ...(layoutChanged ? [prisma.lapRecord.deleteMany({ where: { trackId: existing.id } })] : []),
  ]);

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}

// No owner-facing DELETE here -- deleting a track outright is a moderation
// power reserved for the admin dashboard (/api/admin/tracks/[slug]), not
// something a player gets to do even to their own track. Players keep
// build/save/publish/rename; anything destructive is admin-only.
