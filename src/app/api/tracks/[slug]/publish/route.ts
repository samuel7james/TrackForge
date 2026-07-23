import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import {
  validateTrack,
  validateTerrainAlignment,
  validateImpassableCorners,
  validateObjectsBlockingPath,
} from "@/modules/track-format/validate-track";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// The one place "prevent invalid tracks from being published" (from the
// project brief) is actually enforced -- Phase 5 built the validator and
// deliberately did NOT gate Play with it, only this.
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

  // The engine-swap work's new tile-based format (formatVersion 2) doesn't
  // have layout validators yet -- that lands with the new editor (Phase 5).
  // Rejecting cleanly here rather than crashing on `.splines`, which only
  // exists on v1.
  if (parsed.data.formatVersion !== 1) {
    return NextResponse.json(
      { error: "Publishing this track format isn't supported yet" },
      { status: 501 }
    );
  }

  // Mirrors useTrackValidation client-side (Phase 16) -- the disabled Publish
  // button is only a UX nicety, not a security boundary, in an auth-free
  // system anyone can POST here directly.
  const spline = parsed.data.splines[0];
  const layoutValidation = validateTrack(spline);
  const issues = [
    ...layoutValidation.issues,
    ...validateTerrainAlignment(spline, parsed.data.terrain),
    ...validateImpassableCorners(spline),
    ...validateObjectsBlockingPath(spline, parsed.data.objects),
  ];
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
