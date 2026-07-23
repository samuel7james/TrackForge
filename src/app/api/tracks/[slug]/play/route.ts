import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Fire-and-forget counter, called only from the public track page's autoplay
// flow (a visitor hitting Play from /t/[slug]) -- never from the owner's own
// in-editor testing, so it reflects real external interest (see schema.prisma
// comment on Track.playCount). No auth to check: anyone can inflate this by
// spamming the endpoint, same trust model as every other anonymous write in
// this app (§8) -- acceptable for a simple popularity signal, revisit with
// rate limiting in Phase 20 if it's ever abused.
export async function POST(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  try {
    await prisma.track.update({
      where: { slug },
      data: { playCount: { increment: 1 } },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
