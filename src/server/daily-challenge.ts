import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateRandomDailyTrack } from "@/modules/track-format/generate-daily-track";
import { createEmptyTrackDocument, type Difficulty } from "@/modules/track-format/schema";
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
// generator, so a track already generated earlier that same day would keep
// serving whatever the OLD code produced. Stored in `tags` rather than a
// new column, since this is lightweight enough not to need a migration.
//
//   v5 -- restricted the draw to advanced/expert only.
//   v6 -- widened the generator so layouts can stop repeating: notches on
//         the right edge, split unevenly across three edges, wider size
//         ranges. A v5 track is one of only ~171 possible layouts and
//         predates the layout history table, so it has to be replaced on
//         deploy rather than left to run out the day.
const GENERATOR_VERSION = "6";
const GENERATOR_VERSION_TAG = `gen-v${GENERATOR_VERSION}`;

function hasCurrentGeneratorVersion(tags: string[]): boolean {
  return tags.includes(GENERATOR_VERSION_TAG);
}

type DailyCells = ReturnType<typeof generateRandomDailyTrack>["cells"];

// Identity of a layout, for the "never serve the same track twice" rule.
// Cells are sorted before hashing so that the same set of tiles always
// produces the same fingerprint no matter what order the generator happened
// to emit them in -- otherwise two identical layouts could hash differently
// and one would slip through as "new".
function layoutFingerprint(cells: DailyCells): string {
  const canonical = cells.map((cell) => cell.join(",")).sort();
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** How many fresh layouts to try before giving up on finding an unused one.
 * The generator's pool measures in the tens of thousands and grows with
 * every size/notch combination, so in practice the first attempt is almost
 * always unused; this only bounds the pathological case. */
const MAX_UNIQUE_ATTEMPTS = 40;

// Generates a layout that has never been served before.
//
// Falls back to a repeat only if the pool is genuinely exhausted, which
// would take decades of daily draws -- returning nothing, or looping
// forever, would both be worse than serving a track someone last saw years
// ago. `isFresh` tells the caller which happened so it doesn't record a
// duplicate.
async function generateUnusedDailyTrack(): Promise<{
  cells: DailyCells;
  difficulty: Difficulty;
  fingerprint: string;
  isFresh: boolean;
}> {
  // One query rather than one per attempt: the row count here grows by
  // exactly one per day, so the whole set stays small enough to hold in
  // memory for the length of a request.
  const used = new Set(
    (await prisma.dailyChallengeLayout.findMany({ select: { fingerprint: true } })).map(
      (row) => row.fingerprint
    )
  );

  let last: { cells: DailyCells; difficulty: Difficulty; fingerprint: string } | null = null;
  for (let attempt = 0; attempt < MAX_UNIQUE_ATTEMPTS; attempt++) {
    const { cells, difficulty } = generateRandomDailyTrack();
    const fingerprint = layoutFingerprint(cells);
    last = { cells, difficulty, fingerprint };
    if (!used.has(fingerprint)) return { ...last, isFresh: true };
  }

  return { ...last!, isFresh: false };
}

function buildDailyDocument(cells: DailyCells, difficulty: Difficulty, dateLabel: string) {
  const base = createEmptyTrackDocument(`Daily Challenge — ${dateLabel}`);
  return {
    ...base,
    meta: {
      ...base.meta,
      slug: DAILY_CHALLENGE_SLUG,
      description: "A new random layout and difficulty, every day.",
      difficulty,
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

  const { cells, difficulty, fingerprint, isFresh } = await generateUnusedDailyTrack();
  const document = buildDailyDocument(cells, difficulty, today);
  const name = `Daily Challenge — ${today}`;
  const tags = ["daily-challenge", GENERATOR_VERSION_TAG, dayTag];

  // Recorded so no future day can draw it again. Skipped when the pool came
  // back exhausted, since the row already exists -- and `upsert` rather than
  // `create` because two requests racing the day claim below would otherwise
  // collide on the unique fingerprint.
  const rememberLayout = async (tx: Pick<typeof prisma, "dailyChallengeLayout">) => {
    if (!isFresh) return;
    await tx.dailyChallengeLayout.upsert({
      where: { fingerprint },
      create: { fingerprint, dayLabel: today },
      update: {},
    });
  };

  if (!existing) {
    return prisma.$transaction(async (tx) => {
      await rememberLayout(tx);
      return tx.track.create({
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

    // Only the request that actually claimed the day records the layout, so
    // a layout that never reached anyone isn't burned from the pool.
    await rememberLayout(tx);

    // Yesterday's leaderboard belongs to yesterday's layout -- same
    // reasoning as the PATCH route's owner-edit case.
    await tx.lapRecord.deleteMany({ where: { trackId: existing.id } });
    return tx.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } });
  });

  // Null means another request generated today's track first; read back what
  // it wrote rather than returning the stale row this one had loaded.
  return updated ?? (await prisma.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } })) ?? existing;
}
