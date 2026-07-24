import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Site-wide lap-time moderation -- the admin equivalent of the per-track
// owner-scoped DELETE at /api/tracks/[slug]/laptimes/[id], usable on any
// track's records rather than just one.
export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lapRecord = await prisma.lapRecord.findUnique({ where: { id }, select: { id: true } });
  if (!lapRecord) {
    return NextResponse.json({ error: "Lap time not found" }, { status: 404 });
  }

  await prisma.lapRecord.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
