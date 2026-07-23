import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTHOR_ID_COOKIE } from "@/lib/anonymous-id";
import { TrackCard } from "@/modules/track/track-card";
import { PublicNav } from "@/modules/track/public-nav";

interface CreatorPageProps {
  params: Promise<{ authorId: string }>;
}

// Addressed by authorId, not a login (§8) -- authorId is an unguessable UUID
// but explicitly not a secret (unlike editToken), so this only ever lists
// PUBLISHED tracks, same as anyone browsing /discover would see. Never shows
// drafts here even for the page's own author -- doing that would mean
// trusting the authorId cookie as a security boundary, which it isn't (it's
// forgeable client-side, same as any non-httpOnly cookie).
export default async function CreatorPage({ params }: CreatorPageProps) {
  const { authorId } = await params;
  const viewerAuthorId = (await cookies()).get(AUTHOR_ID_COOKIE)?.value;
  const isOwnPage = viewerAuthorId === authorId;

  const tracks = await prisma.track.findMany({
    where: { authorId, isPublished: true },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      name: true,
      description: true,
      tags: true,
      playCount: true,
      likeCount: true,
      document: true,
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isOwnPage ? "Your tracks" : `Tracks by ${authorId.slice(0, 8)}`}
          </h1>
        </div>
        <PublicNav current={isOwnPage ? "/my-tracks" : undefined} />
      </div>

      {tracks.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {isOwnPage
            ? "You haven't published any tracks yet."
            : "This creator hasn't published any tracks yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <TrackCard key={track.slug} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
