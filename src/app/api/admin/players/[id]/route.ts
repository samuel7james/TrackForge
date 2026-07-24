import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Deleting a claimed player identity is global (a DisplayName row isn't
// scoped to any one track), so unlike lap times this stays admin-only --
// no track owner action for this, even on their own track.
export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const player = await prisma.displayName.findUnique({ where: { id }, select: { id: true } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  await prisma.displayName.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
