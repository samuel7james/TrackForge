import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminTrackActions } from "./admin-track-actions";
import { AdminCommentActions } from "./admin-comment-actions";
import { LogoutButton } from "./logout-button";

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Deliberately basic: counts + two lists (tracks, comments), each with the
// same moderation actions a track owner already has (delete, publish/
// unpublish), exercised site-wide instead of per-track. No search/filter,
// no pagination beyond a fixed cap -- not needed at this scale yet.
export default async function AdminDashboardPage() {
  const [
    trackCount,
    publishedCount,
    playAndLikeTotals,
    commentCount,
    lapRecordCount,
    tracks,
    comments,
  ] = await Promise.all([
    prisma.track.count(),
    prisma.track.count({ where: { isPublished: true } }),
    prisma.track.aggregate({ _sum: { playCount: true, likeCount: true } }),
    prisma.comment.count(),
    prisma.lapRecord.count(),
    prisma.track.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        slug: true,
        name: true,
        authorId: true,
        isPublished: true,
        playCount: true,
        likeCount: true,
        createdAt: true,
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
  ]);

  const stats = [
    { label: "Tracks", value: trackCount },
    { label: "Published", value: publishedCount },
    { label: "Total plays", value: playAndLikeTotals._sum.playCount ?? 0 },
    { label: "Total likes", value: playAndLikeTotals._sum.likeCount ?? 0 },
    { label: "Comments", value: commentCount },
    { label: "Lap records", value: lapRecordCount },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Plays</th>
                <th className="p-3 font-medium">Likes</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.slug} className="border-b border-border/30 last:border-0">
                  <td className="p-3">
                    <Link href={`/t/${track.slug}`} className="font-medium hover:underline">
                      {track.name}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {track.authorId.slice(0, 8)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {track.isPublished ? "Published" : "Draft"}
                  </td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track.playCount}</td>
                  <td className="p-3 tabular-nums text-muted-foreground">{track.likeCount}</td>
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
