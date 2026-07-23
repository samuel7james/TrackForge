import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { DiscoverControls } from "@/modules/discover/discover-controls";

interface DiscoverPageProps {
  searchParams: Promise<{ sort?: string; q?: string }>;
}

const SORTS = ["new", "played", "top"] as const;
type Sort = (typeof SORTS)[number];

function isSort(value: string | undefined): value is Sort {
  return SORTS.includes(value as Sort);
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

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
          <h1 className="text-3xl font-semibold tracking-tight">Discover tracks</h1>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
      </div>

      <DiscoverControls sort={sort} query={query} />

      {tracks.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {query ? `No published tracks match "${query}".` : "No published tracks yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => {
            const meta = (track.document as { meta?: { difficulty?: string } })?.meta;
            const difficulty = meta?.difficulty ? DIFFICULTY_LABELS[meta.difficulty] : null;
            return (
              <Link key={track.slug} href={`/t/${track.slug}`}>
                <Card className="h-full transition hover:ring-foreground/25">
                  <CardHeader>
                    <CardTitle>{track.name}</CardTitle>
                    {track.description && (
                      <CardDescription className="line-clamp-2">
                        {track.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {track.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {track.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{difficulty ?? "Beginner"}</span>
                    <span className="flex items-center gap-2">
                      <span>{track.likeCount} like{track.likeCount === 1 ? "" : "s"}</span>
                      <span>{track.playCount} play{track.playCount === 1 ? "" : "s"}</span>
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
