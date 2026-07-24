import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatLapTime } from "@/modules/game-engine/lap-timer";
import { DIFFICULTY_LABELS } from "@/modules/track/difficulty-labels";
import { AdminTrackActions } from "./admin-track-actions";
import { AdminCommentActions } from "./admin-comment-actions";
import { LogoutButton } from "./logout-button";

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Every content type in the schema, one list each: tracks (full detail --
// description/tags/difficulty/comment+lap+save counts), players (every
// claimed racer name, merged with their race count/best time), lap times
// (site-wide, fastest first), likes, comments. Track/comment moderation
// actions mirror what an owner already has, exercised site-wide instead of
// per-track. No search/filter, no pagination beyond a fixed cap -- not
// needed at this scale yet.
export default async function AdminDashboardPage() {
  const [
    trackCount,
    publishedCount,
    playAndLikeTotals,
    commentCount,
    lapRecordCount,
    likeCount,
    tracks,
    comments,
    likes,
    players,
    lapStats,
    lapTimes,
  ] = await Promise.all([
    prisma.track.count(),
    prisma.track.count({ where: { isPublished: true } }),
    prisma.track.aggregate({ _sum: { playCount: true, likeCount: true } }),
    prisma.comment.count(),
    prisma.lapRecord.count(),
    prisma.like.count(),
    prisma.track.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        slug: true,
        name: true,
        description: true,
        tags: true,
        difficulty: true,
        authorId: true,
        isPublished: true,
        playCount: true,
        likeCount: true,
        createdAt: true,
        _count: { select: { comments: true, lapRecords: true, versions: true } },
      },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        displayName: true,
        body: true,
        createdAt: true,
        track: { select: { slug: true, name: true } },
      },
    }),
    // Every like site-wide -- no name attached (unlike comments/lap times),
    // just a viewerId + which track, since that's all a Like row is.
    prisma.like.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        viewerId: true,
        createdAt: true,
        track: { select: { slug: true, name: true } },
      },
    }),
    // Every claimed racer name -- the closest thing to a "player" identity
    // in this anonymous, no-accounts app (see schema.prisma's own comment
    // on DisplayName). Commenters/likers have no persistent identity to
    // list here at all -- comments are freeform every time, likes are a
    // bare viewerId with no name attached.
    prisma.displayName.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    // Per-viewer race count + best time, merged into `players` below by
    // viewerId -- Prisma has no way to join this directly into the
    // findMany above.
    prisma.lapRecord.groupBy({ by: ["viewerId"], _count: { _all: true }, _min: { timeMs: true } }),
    // Every lap time site-wide, fastest first -- a flat cross-track view
    // rather than nested under each track/player row, simplest way to see
    // "every lap time" at a glance.
    prisma.lapRecord.findMany({
      orderBy: { timeMs: "asc" },
      take: 200,
      select: {
        id: true,
        displayName: true,
        timeMs: true,
        updatedAt: true,
        track: { select: { slug: true, name: true } },
      },
    }),
  ]);

  const lapStatsByViewer = new Map(lapStats.map((s) => [s.viewerId, s]));

  const stats = [
    { label: "Tracks", value: trackCount },
    { label: "Published", value: publishedCount },
    { label: "Total plays", value: playAndLikeTotals._sum.playCount ?? 0 },
    { label: "Likes", value: likeCount },
    { label: "Comments", value: commentCount },
    { label: "Players", value: players.length },
    { label: "Lap records", value: lapRecordCount },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border/50 p-3">
            <div className="text-2xl font-semibold tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Tracks ({tracks.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Author</th>
                <th className="p-3 font-medium">Difficulty</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Plays</th>
                <th className="p-3 font-medium">Likes</th>
                <th className="p-3 font-medium">Comments</th>
                <th className="p-3 font-medium">Laps</th>
                <th className="p-3 font-medium">Saves</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.slug} className="border-b border-border/30 last:border-0 align-top">
                  <td className="p-3">
                    <Link href={`/t/${track.slug}`} className="font-medium hover:underline">
                      {track.name}
                    </Link>
                    {track.description && (
                      <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                        {track.description}
                      </p>
                    )}
                    {track.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {track.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {track.authorId.slice(0, 8)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {DIFFICULTY_LABELS[track.difficulty] ?? track.difficulty}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {track.isPublished ? "Published" : "Draft"}
                  </td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track.playCount}</td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track.likeCount}</td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track._count.comments}</td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track._count.lapRecords}</td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track._count.versions}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(track.createdAt)}</td>
                  <td className="p-3">
                    <AdminTrackActions slug={track.slug} isPublished={track.isPublished} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Players ({players.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Viewer ID</th>
                <th className="p-3 font-medium">Races</th>
                <th className="p-3 font-medium">Best lap</th>
                <th className="p-3 font-medium">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const stat = lapStatsByViewer.get(player.viewerId);
                return (
                  <tr key={player.viewerId} className="border-b border-border/30 last:border-0">
                    <td className="p-3 font-medium">{player.name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {player.viewerId.slice(0, 8)}
                    </td>
                    <td className="p-3 tabular-nums text-muted-foreground">
                      {stat?._count._all ?? 0}
                    </td>
                    <td className="p-3 tabular-nums text-muted-foreground">
                      {stat?._min.timeMs ? formatLapTime(stat._min.timeMs / 1000) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(player.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Lap times ({lapTimes.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Player</th>
                <th className="p-3 font-medium">Track</th>
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {lapTimes.map((lap) => (
                <tr key={lap.id} className="border-b border-border/30 last:border-0">
                  <td className="p-3 font-medium">{lap.displayName}</td>
                  <td className="p-3">
                    <Link href={`/t/${lap.track.slug}`} className="hover:underline">
                      {lap.track.name}
                    </Link>
                  </td>
                  <td className="p-3 tabular-nums text-muted-foreground">
                    {formatLapTime(lap.timeMs / 1000)}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(lap.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Likes ({likes.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Viewer ID</th>
                <th className="p-3 font-medium">Track</th>
                <th className="p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {likes.map((like) => (
                <tr key={like.id} className="border-b border-border/30 last:border-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {like.viewerId.slice(0, 8)}
                  </td>
                  <td className="p-3">
                    <Link href={`/t/${like.track.slug}`} className="hover:underline">
                      {like.track.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(like.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Comments ({comments.length})</h2>
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-3 text-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.displayName}</span>
                  <span>on</span>
                  <Link href={`/t/${comment.track.slug}`} className="hover:underline">
                    {comment.track.name}
                  </Link>
                  <span>{formatDate(comment.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
              </div>
              <AdminCommentActions id={comment.id} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
