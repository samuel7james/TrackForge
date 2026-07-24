import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { DIFFICULTY_LABELS } from "@/modules/track/difficulty-labels";

export interface TrackCardData {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  playCount: number;
  likeCount: number;
  difficulty: string;
}

// Shared between Discover and creator pages -- both list published tracks in
// the same card shape, and letting them drift into two copies would just
// mean fixing the same layout bug twice.
export function TrackCard({ track }: { track: TrackCardData }) {
  const difficulty = DIFFICULTY_LABELS[track.difficulty];

  return (
    <Link href={`/t/${track.slug}`}>
      <Card className="h-full transition hover:ring-foreground/25">
        <CardHeader>
          <CardTitle>{track.name}</CardTitle>
          {track.description && (
            <CardDescription className="line-clamp-2">{track.description}</CardDescription>
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
}
