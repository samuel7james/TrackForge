import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_BODY_LENGTH = 500;

// Freeform display name instead of an account (§8) -- no login, so no
// identity to check beyond "not empty, not absurdly long." Volume-based
// abuse (spam floods) is a Phase 20 rate-limiting concern, not this route's.
export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);

  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json({ error: "Name must be 1-40 characters" }, { status: 400 });
  }
  if (!text || text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: "Comment must be 1-500 characters" }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { trackId: track.id, displayName, body: text },
  });

  return NextResponse.json({
    id: comment.id,
    displayName: comment.displayName,
    body: comment.body,
    createdAt: comment.createdAt,
  });
}
