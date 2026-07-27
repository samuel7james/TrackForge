import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOrCreateDailyChallenge, DAILY_CHALLENGE_SLUG } from "@/server/daily-challenge";
import { Leaderboard, type LeaderboardOwnEntry } from "@/modules/track/leaderboard";
import { DIFFICULTY_LABELS } from "@/modules/track/difficulty-labels";
import { PublicNav } from "@/modules/track/public-nav";
import { VIEWER_ID_COOKIE } from "@/lib/anonymous-id";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

const LEADERBOARD_TOP_N = 20;

// A dedicated page, not just another Discover entry -- the daily challenge
// isn't a track anyone made, it's a fresh random layout + difficulty every
// day with its own leaderboard that resets alongside it (see
// server/daily-challenge.ts). No comments/likes here: both would survive
// across a layout that changes underneath them daily, which reads as
// broken rather than a real feature, so this stays focused on today's
// layout, its difficulty, and the leaderboard.
export default async function DailyChallengePage() {
  const track = await getOrCreateDailyChallenge();

  const viewerId = (await cookies()).get(VIEWER_ID_COOKIE)?.value ?? "";
  const topLapRecords = await prisma.lapRecord.findMany({
    where: { trackId: track.id },
    orderBy: { timeMs: "asc" },
    take: LEADERBOARD_TOP_N,
    select: { displayName: true, timeMs: true, viewerId: true },
  });

  let ownLapRecord: LeaderboardOwnEntry | null = null;
  if (viewerId && !topLapRecords.some((r) => r.viewerId === viewerId)) {
    const mine = await prisma.lapRecord.findUnique({
      where: { trackId_viewerId: { trackId: track.id, viewerId } },
      select: { displayName: true, timeMs: true },
    });
    if (mine) {
      const rank = await prisma.lapRecord.count({
        where: { trackId: track.id, timeMs: { lt: mine.timeMs } },
      });
      ownLapRecord = { rank: rank + 1, displayName: mine.displayName, timeMs: mine.timeMs };
    }
  }

  // India time explicitly -- see daily-challenge.ts's own comment on why
  // this can't be server-local/default formatting (a Server Component
  // renders wherever the request happens to land, and Date formatting
  // without an explicit timeZone reflects that, not India's).
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
        </div>
        <PublicNav current="/challenge" />
      </div>

      <div className="flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-1 duration-500">
        <h1 className="text-4xl font-semibold tracking-tight">Today&apos;s Challenge</h1>
        <p className="text-muted-foreground">{today} — a new random layout every day.</p>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Difficulty</dt>
          <dd className="font-medium">
            {DIFFICULTY_LABELS[track.difficulty] ?? track.difficulty}
          </dd>
        </div>
      </dl>

      <Button
        size="lg"
        className="w-fit gap-2"
        nativeButton={false}
        // Plain <a>, not next/link -- same reasoning as track-card.tsx:
        // this is per-day dynamic content, and a stale cached snapshot of
        // "yesterday's" challenge is exactly the class of bug that fix
        // was for.
        render={<a href={`/editor/${DAILY_CHALLENGE_SLUG}?autoplay=1`} />}
      >
        <Play className="size-4" />
        Play today&apos;s challenge
      </Button>

      <Leaderboard
        entries={topLapRecords.map((r, i) => ({
          rank: i + 1,
          displayName: r.displayName,
          timeMs: r.timeMs,
          isViewer: r.viewerId === viewerId,
        }))}
        own={ownLapRecord}
      />
    </div>
  );
}
