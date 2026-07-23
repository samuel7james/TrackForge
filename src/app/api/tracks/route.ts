import { randomUUID, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { generateSlug } from "@/server/slug";

const MAX_SLUG_ATTEMPTS = 5;

function isUniqueSlugConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray((error.meta as { target?: unknown })?.target) &&
    ((error.meta as { target: string[] }).target ?? []).includes("slug")
  );
}

// Creates a new track from the client's current in-memory document — by the
// time a user hits Save for the first time they may already have built part
// of a track, so creation captures whatever exists rather than starting blank.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParseTrackDocument(body?.document);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid track document" }, { status: 400 });
  }
  const document = parsed.data;
  const editToken = randomBytes(32).toString("hex");
  const authorId = randomUUID(); // anonymous for Milestone 1 -- see PROJECT_PLAN.md §8

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = generateSlug();
    // The document stored in the DB must carry its own slug — the client
    // doesn't know it yet at this point (it's generated here), so if we
    // stored the document as-is, a later reload would fetch a document
    // whose meta.slug is still "", silently reverting the client's local
    // assignment and causing the next save to create a duplicate track.
    const documentWithSlug = { ...document, meta: { ...document.meta, slug } };
    try {
      const track = await prisma.track.create({
        data: {
          slug,
          name: document.meta.name,
          description: document.meta.description,
          tags: document.meta.tags,
          authorId,
          editToken,
          document: documentWithSlug,
        },
      });
      return NextResponse.json({ id: track.id, slug: track.slug, editToken });
    } catch (error) {
      if (isUniqueSlugConflict(error)) continue;
      throw error;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique slug, try again" },
    { status: 500 }
  );
}
