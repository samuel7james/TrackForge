import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateRandomDailyTrack } from "@/modules/track-format/generate-daily-track";
import { createEmptyTrackDocument } from "@/modules/track-format/schema";
import { DAILY_CHALLENGE_SLUG } from "@/lib/daily-challenge-slug";

// Re-exported so existing server-side imports (challenge/page.tsx,
// discover/page.tsx, sitemap.ts) don't need to change -- the constant
// itself lives in lib/daily-challenge-slug.ts so client components can
// import it too without pulling in this file's Prisma dependency.
export { DAILY_CHALLENGE_SLUG };

// The daily rollover is anchored to India Standard Time specifically, not
// server-local time or UTC -- a server can run in any region (Vercel's
// functions aren't guaranteed a fixed one), and JS Date is internally
// timezone-agnostic regardless, so toISOString() would roll the day over
// at UTC midnight = 5:30 AM IST, not IST midnight. en-CA's locale format
// happens to be exactly "YYYY-MM-DD", so this needs no manual parsing.
const CHALLENGE_TIMEZONE = "Asia/Kolkata";

function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: CHALLENGE_TIMEZONE });
}

function dateInIndia(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: CHALLENGE_TIMEZONE });
}

// Bump this whenever generate-daily-track.ts's output would meaningfully
// change (a real bug fix, not a comment/refactor). Without this, fixing
// the generator does nothing visible until the next actual IST midnight:
// the "is this still today's track" check below only looks at the
// calendar date, which stays satisfied even after a deploy ships a fixed
// generator, so a fresh production track already generated once earlier
// that same day would keep serving whatever the OLD code produced. Stored
// in `tags` rather than a new column, since this is lightweight enough
// not to need a schema migration.
const GENERATOR_VERSION = "4";
const GENERATOR_VERSION_TAG = `gen-v${GENERATOR_VERSION}`;

function hasCurrentGeneratorVersion(tags: string[]): boolean {
  return tags.includes(GENERATOR_VERSION_TAG);
}

function buildDailyDocument(cells: ReturnType<typeof generateRandomDailyTrack>["cells"], difficulty: string, dateLabel: string) {
  const base = createEmptyTrackDocument(`Daily Challenge — ${dateLabel}`);
  return {
    ...base,
    meta: {
      ...base.meta,
      slug: DAILY_CHALLENGE_SLUG,
      description: "A new random layout and difficulty, every day.",
      difficulty: difficulty as (typeof base.meta)["difficulty"],
    },
    track: { cells },
  };
}

// Ensures today's challenge exists and is actually today's -- lazy,
// on-visit regeneration rather than a cron job, so this is self-healing
// (works the same locally and in prod, no dependency on Vercel Cron
// actually firing) at the cost of the first visitor each day paying the
// generation cost. Reuses the exact same "wipe LapRecords when the layout
// changes" transaction shape as the PATCH route's own owner-edit case --
// a new day's layout is exactly that, just system-triggered instead of
// an owner's save.
export async function getOrCreateDailyChallenge() {
  const today = todayInIndia();
  const existing = await prisma.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } });

  if (existing && dateInIndia(existing.updatedAt) === today && hasCurrentGeneratorVersion(existing.tags)) {
    return existing;
  }

  const { cells, difficulty } = generateRandomDailyTrack();
  const document = buildDailyDocument(cells, difficulty, today);
  const name = `Daily Challenge — ${today}`;
  const tags = ["daily-challenge", GENERATOR_VERSION_TAG];

  if (!existing) {
    return prisma.track.create({
      data: {
        slug: DAILY_CHALLENGE_SLUG,
        name,
        description: document.meta.description,
        authorId: "system",
        // Random and never handed to any client -- there's no owner UI for
        // this track, so nothing needs to ever PATCH/DELETE it through the
        // normal editToken-gated routes.
        editToken: randomBytes(32).toString("hex"),
        document,
        isPublished: true,
        difficulty,
        tags,
      },
    });
  }

  const [updated] = await prisma.$transaction([
    prisma.track.update({
      where: { slug: DAILY_CHALLENGE_SLUG },
      data: { name, description: document.meta.description, document, difficulty, tags },
    }),
    prisma.lapRecord.deleteMany({ where: { trackId: existing.id } }),
  ]);
  return updated;
}
