import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// The one place "prevent invalid tracks from being published" (from the
// project brief) is actually enforced -- the disabled Publish button
// client-side is only a UX nicety, not a security boundary, in an
// auth-free system anyone can POST here directly.
//
// Deliberately minimal for the tile-based format: a finish cell (so
// LapTimer actually activates -- see its own `enabled` check, the same
// condition) and more than one cell total (so a lone finish tile with
// nothing built around it doesn't count as a track). A fuller connectivity
// validator (are all cells actually reachable from the finish) is a
// reasonable follow-up, not attempted here.
export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const editToken = request.headers.get("x-edit-token");
  if (!editToken) {
    return NextResponse.json({ error: "Missing edit token" }, { status: 401 });
  }

  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.editToken !== editToken) {
    return NextResponse.json({ error: "Invalid edit token" }, { status: 403 });
  }

  const parsed = safeParseTrackDocument(track.document);
  if (!parsed.success) {
    return NextResponse.json({ error: "Track data is corrupted" }, { status: 500 });
  }

  const issues: { code: string; message: string }[] = [];
  const cells = parsed.data.track.cells;
  if (!cells.some((c) => c[2] === "track-finish")) {
    issues.push({ code: "no-finish", message: "Track needs a finish line" });
  }
  if (cells.length < 2) {
    issues.push({ code: "too-short", message: "Track needs more than just the finish line" });
  }
  if (issues.length > 0) {
    return NextResponse.json(
      { error: "Track is not ready to publish", issues },
      { status: 422 }
    );
  }

  const updated = await prisma.track.update({
    where: { slug },
    data: { isPublished: true },
  });

  return NextResponse.json({ ok: true, isPublished: updated.isPublished });
}
