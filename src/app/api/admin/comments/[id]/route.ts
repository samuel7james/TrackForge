import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Comment moderation doesn't exist for track owners at all (Comment has no
// owner-facing delete route today) -- admin-only capability.
export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  await prisma.comment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
