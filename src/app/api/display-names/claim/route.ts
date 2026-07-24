import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateAnonymousId, VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10; // renaming isn't a hot path -- generous courtesy limit, same shape as like/route.ts
const MAX_NAME_LENGTH = 40;

function isUniqueNameConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray((error.meta as { target?: unknown })?.target) &&
    ((error.meta as { target: string[] }).target ?? []).includes("name")
  );
}

// Called from DisplayNameGate before a racing name is saved locally --
// claims it globally so no two browsers can race under the same name.
// One row per viewer (see schema.prisma's own comment): renaming updates
// the same row, implicitly freeing the old name rather than leaving a
// trail of every name a viewer has ever tried.
export async function POST(request: Request) {
  const viewerId = await getOrCreateAnonymousId(VIEWER_ID_COOKIE);
  if (!checkRateLimit(`display-name:${viewerId}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name must be 1-40 characters" }, { status: 400 });
  }

  const existing = await prisma.displayName.findUnique({ where: { name } });
  if (existing && existing.viewerId !== viewerId) {
    return NextResponse.json({ error: "That name is already taken" }, { status: 409 });
  }

  try {
    const claimed = await prisma.displayName.upsert({
      where: { viewerId },
      create: { viewerId, name },
      update: { name },
    });
    return NextResponse.json({ name: claimed.name });
  } catch (error) {
    // Two browsers claiming the same free name at once -- the findUnique
    // check above can't fully close this race, the DB's unique constraint
    // is the real guarantee.
    if (isUniqueNameConflict(error)) {
      return NextResponse.json({ error: "That name is already taken" }, { status: 409 });
    }
    throw error;
  }
}
