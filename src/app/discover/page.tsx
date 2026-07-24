import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DiscoverControls } from "@/modules/discover/discover-controls";
import { TrackCard } from "@/modules/track/track-card";
import { PublicNav } from "@/modules/track/public-nav";

interface DiscoverPageProps {
  searchParams: Promise<{ sort?: string; q?: string }>;
}

const SORTS = ["new", "played", "top"] as const;
type Sort = (typeof SORTS)[number];

function isSort(value: string | undefined): value is Sort {
  return SORTS.includes(value as Sort);
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const { sort: rawSort, q } = await searchParams;
  const sort = isSort(rawSort) ? rawSort : "new";
  const query = (q ?? "").trim();

  const orderBy: Prisma.TrackOrderByWithRelationInput =
    sort === "played"
      ? { playCount: "desc" }
      : sort === "top"
        ? { likeCount: "desc" }
        : { createdAt: "desc" };

  const where: Prisma.TrackWhereInput = {
    isPublished: true,
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { tags: { has: query.toLowerCase() } },
      ],
    }),
  };

  const tracks = await prisma.track.findMany({
    where,
    orderBy,
    take: 24,
    select: {
      slug: true,
      name: true,
      description: true,
      tags: true,
      playCount: true,
      likeCount: true,
      difficulty: true,
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Discover tracks</h1>
        </div>
        <PublicNav current="/discover" />
      </div>

      <DiscoverControls sort={sort} query={query} />

      {tracks.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {query ? `No published tracks match "${query}".` : "No published tracks yet."}
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
