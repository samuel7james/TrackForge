import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";

interface RouteContext {
  params: Promise<{ slug: string }>;
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
export async function PATCH(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const editToken = request.headers.get("x-edit-token");
  if (!editToken) {
    return NextResponse.json({ error: "Missing edit token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = safeParseTrackDocument(body?.document);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid track document" }, { status: 400 });
  }
  const document = parsed.data;

  const existing = await prisma.track.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (existing.editToken !== editToken) {
    return NextResponse.json({ error: "Invalid edit token" }, { status: 403 });
  }

  const [updated] = await prisma.$transaction([
    prisma.track.update({
      where: { slug },
      data: {
        document,
        name: document.meta.name,
        description: document.meta.description,
      },
    }),
    // One row per save (PROJECT_PLAN.md §7) — empty of product features
    // until Milestone 3's version history UI, but capturing the trail from
    // day one avoids a backfill later.
    prisma.trackVersion.create({
      data: { trackId: existing.id, document },
    }),
  ]);

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
