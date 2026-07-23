import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { PublicTrackActions } from "@/modules/track/public-track-actions";
import { TrackEngagement } from "@/modules/track/track-engagement";
import { DIFFICULTY_LABELS } from "@/modules/track/difficulty-labels";
import { VIEWER_ID_COOKIE } from "@/lib/anonymous-id";

interface PublicTrackPageProps {
  params: Promise<{ slug: string }>;
}

function formatEstimatedTime(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default async function PublicTrackPage({ params }: PublicTrackPageProps) {
  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) notFound();

  const parsed = safeParseTrackDocument(track.document);
  // No lap-time estimator for the tile-based format yet -- shows "—" until
  // one exists (estimating from a cell-grid loop is a different algorithm
  // than the old spline-length one, not yet written).
  const estimatedLapTimeMs: number | null = null;
  const difficulty = parsed.success ? parsed.data.meta.difficulty : "beginner";

  // Reads the cookie middleware.ts already guaranteed exists -- deliberately
  // NOT getOrCreateAnonymousId here, since Server Components can only read
  // cookies (calling .set() from one throws); an empty fallback just means
  // "not liked yet," never a crash.
  const viewerId = (await cookies()).get(VIEWER_ID_COOKIE)?.value ?? "";
  const [initialLike, comments] = track.isPublished
    ? await Promise.all([
        viewerId
          ? prisma.like.findUnique({
              where: { trackId_viewerId: { trackId: track.id, viewerId } },
            })
          : null,
        prisma.comment.findMany({
          where: { trackId: track.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ])
    : [null, []];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <span>TrackForge</span>
        {!track.isPublished && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400">
            Draft
          </span>
        )}
      </div>

      <h1 className="text-4xl font-semibold tracking-tight">{track.name}</h1>
      {track.description && (
        <p className="max-w-lg text-muted-foreground">{track.description}</p>
      )}

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Difficulty</dt>
          <dd className="font-medium">
            {DIFFICULTY_LABELS[difficulty] ?? difficulty}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated lap</dt>
          <dd className="font-medium">{formatEstimatedTime(estimatedLapTimeMs)}</dd>
        </div>
      </dl>

      <PublicTrackActions slug={slug} name={track.name} isPublished={track.isPublished} />

      {track.isPublished && (
        <Link
          href={`/creator/${track.authorId}`}
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          More tracks by this creator →
        </Link>
      )}

      {track.isPublished && (
        <TrackEngagement
          slug={slug}
          initialLiked={Boolean(initialLike)}
          initialLikeCount={track.likeCount}
          initialComments={comments.map((comment) => ({
            id: comment.id,
            displayName: comment.displayName,
            body: comment.body,
            createdAt: comment.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
