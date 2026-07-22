import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { validateTrack } from "@/modules/track-format/validate-track";

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

  const { isValid, issues } = validateTrack(parsed.data.splines[0]);
  if (!isValid) {
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
