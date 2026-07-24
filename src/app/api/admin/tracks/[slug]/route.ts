import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Same actions the track's own owner already has (see
// api/tracks/[slug]/route.ts's DELETE and .../publish/route.ts) -- gated
// on the admin session instead of editToken, so they apply to any track
// site-wide, not just ones this browser holds the token for.
export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.isPublished !== "boolean") {
    return NextResponse.json({ error: "isPublished must be a boolean" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const updated = await prisma.track.update({
    where: { slug },
    data: { isPublished: body.isPublished },
  });

  return NextResponse.json({ ok: true, isPublished: updated.isPublished });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // TrackVersion/Like/Comment/LapRecord all cascade via the schema's
  // onDelete: Cascade, same as the owner-facing DELETE route.
  await prisma.track.delete({ where: { slug } });

  return NextResponse.json({ ok: true });
}
