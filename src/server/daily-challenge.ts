import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateRandomDailyTrack } from "@/modules/track-format/generate-daily-track";
import { createEmptyTrackDocument } from "@/modules/track-format/schema";

// A fixed, reserved slug rather than a boolean/flag column -- Track.slug is
// already unique, so this needs zero schema changes and is trivially
// excludable from Discover/sitemap by name. No real user's random
// generateSlug() output collides with a fixed word, and even if it somehow
// did, DB uniqueness would just reject that one save attempt.
export const DAILY_CHALLENGE_SLUG = "daily-challenge";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
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
  const today = todayUTC();
  const existing = await prisma.track.findUnique({ where: { slug: DAILY_CHALLENGE_SLUG } });

  if (existing && existing.updatedAt.toISOString().slice(0, 10) === today) {
    return existing;
  }

  const { cells, difficulty } = generateRandomDailyTrack();
  const document = buildDailyDocument(cells, difficulty, today);
  const name = `Daily Challenge — ${today}`;

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
        tags: ["daily-challenge"],
      },
    });
  }

  const [updated] = await prisma.$transaction([
    prisma.track.update({
      where: { slug: DAILY_CHALLENGE_SLUG },
      data: { name, description: document.meta.description, document, difficulty },
    }),
    prisma.lapRecord.deleteMany({ where: { trackId: existing.id } }),
  ]);
  return updated;
}
