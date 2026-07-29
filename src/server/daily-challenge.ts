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

// Which IST day a stored challenge was generated for, recorded on the row
// itself.
//
// This used to be inferred from `updatedAt`, which was wrong in both
// directions, because Prisma's @updatedAt tracks the last write of any kind
// -- and the playCount increment writes to this very row on every single
// play (see api/tracks/[slug]/play). So the anchor for "is this still
// today's track" moved whenever anyone raced: a play just after IST
// midnight re-stamped the row into the new day, satisfying the check and
// serving yesterday's layout for another 24 hours, while a day with no
// plays at all left it stale enough to regenerate at some arbitrary hour.
// Either way the rollover drifted off midnight.
//
// A tag can only change when this function changes it, so the date it
// encodes means exactly what it says. Kept in `tags` for the same reason
// GENERATOR_VERSION_TAG is -- no migration needed -- and the challenge is
// excluded from Discover (see discover/page.tsx), so it's only ever visible
// in the admin dashboard, where knowing which day a track was cut for is
// useful rather than noise.
function dayTagFor(dateLabel: string): string {
  return `day-${dateLabel}`;
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
// Bumped to 5: the generator now only draws from advanced/expert (see
// DAILY_CHALLENGE_TIERS). Without the bump, a beginner or intermediate
// track already generated earlier today would keep serving until the next
// IST midnight, since the day tag alone would still be satisfied.
const GENERATOR_VERSION = "5";
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
  const dayTag = dayTagFor(today);
  const existing = await prisma.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } });

  if (existing && existing.tags.includes(dayTag) && hasCurrentGeneratorVersion(existing.tags)) {
    return existing;
  }

  const { cells, difficulty } = generateRandomDailyTrack();
  const document = buildDailyDocument(cells, difficulty, today);
  const name = `Daily Challenge — ${today}`;
  const tags = ["daily-challenge", GENERATOR_VERSION_TAG, dayTag];

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

  // Conditional on the day tag still being absent, so the write itself is
  // what claims the new day. Two visitors arriving together just after IST
  // midnight would otherwise both regenerate: the second would overwrite
  // the first's layout and wipe the lap records already set on it, so
  // whoever raced first would silently lose their time. Here the second
  // update matches zero rows and leaves the first alone.
  //
  // Interactive rather than an array transaction because the lap-record
  // wipe has to be conditional on that match -- issued unconditionally it
  // would clear the *new* day's times on the request that lost the race.
  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.track.updateMany({
      where: {
        slug: DAILY_CHALLENGE_SLUG,
        OR: [{ NOT: { tags: { has: dayTag } } }, { NOT: { tags: { has: GENERATOR_VERSION_TAG } } }],
      },
      data: { name, description: document.meta.description, document, difficulty, tags },
    });
    if (claim.count === 0) return null;

    // Yesterday's leaderboard belongs to yesterday's layout -- same
    // reasoning as the PATCH route's owner-edit case.
    await tx.lapRecord.deleteMany({ where: { trackId: existing.id } });
    return tx.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } });
  });

  // Null means another request generated today's track first; read back what
  // it wrote rather than returning the stale row this one had loaded.
  return updated ?? (await prisma.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } })) ?? existing;
}
