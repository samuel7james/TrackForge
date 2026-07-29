import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { computeTrackDifficulty } from "@/modules/track-format/auto-difficulty";
import { generateSlug } from "@/server/slug";
import { getOrCreateAnonymousId, AUTHOR_ID_COOKIE } from "@/lib/anonymous-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitKey } from "@/lib/client-ip";

const MAX_SLUG_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20; // 20 new tracks per origin per 10 minutes

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
  // Stable per-browser id (PROJECT_PLAN.md §8) -- the same value across every
  // track this browser creates, not a fresh one per save, so a Phase 19
  // creator page can actually group tracks by it.
  const authorId = await getOrCreateAnonymousId(AUTHOR_ID_COOKIE);
  // This was the one unlimited write in the app: every other mutation route
  // (comments, likes, lap times, name claims) already rate-limits, but track
  // creation -- by far the most expensive row to store -- did not, so a
  // script could fill the database with tracks as fast as it could POST.
  // The cap is far above real use: creating even two tracks in a session is
  // unusual, since the editor reuses one via PATCH after the first save.
  //
  // Keyed by origin address, not by authorId: a caller that simply omits
  // the cookie is handed a brand-new authorId on every single request, so
  // an id-keyed budget here would have been bypassed by the exact scripted
  // traffic it exists to stop (measured -- it never triggered at all). The
  // other mutation routes stay viewerId-keyed on purpose: their rows are
  // cheap, their limits are tighter, and an address-keyed budget there
  // would make a household or campus behind one NAT share a comment quota.
  if (!checkRateLimit(rateLimitKey(request, "track-create", authorId), RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json(
      { error: "Too many tracks created — try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = safeParseTrackDocument(body?.document);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid track document" }, { status: 400 });
  }
  const difficulty = computeTrackDifficulty(parsed.data.track.cells);
  const document = { ...parsed.data, meta: { ...parsed.data.meta, difficulty } };
  const editToken = randomBytes(32).toString("hex");

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
          difficulty: document.meta.difficulty,
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
