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
// mean fixing the same layout bug twice. `index` drives a staggered
// entrance (capped so a page of 24 cards doesn't take 2+ seconds to
// finish appearing) -- pure CSS (tw-animate-css, already a dependency for
// Dialog/Popover), no client component or JS needed for a Server
// Component list like this one.
export function TrackCard({ track, index = 0 }: { track: TrackCardData; index?: number }) {
  const difficulty = DIFFICULTY_LABELS[track.difficulty];

  return (
    // A plain <a>, not next/link -- three rounds of Router-Cache-specific
    // fixes (staleTimes, prefetch={false} on every relevant link, checking
    // for a stale `slug` prop) all failed to fully stop a reported "wrong
    // track loads" bug on this exact click path, and a manual refresh has
    // reliably shown the correct track every single time it's happened.
    // A real full-page navigation is what a refresh does -- using a
    // native anchor here guarantees the same fresh-render guarantee on
    // every click instead of trusting any client-side cache layer, at
    // the cost of losing the SPA transition for this one hop.
    <a href={`/t/${track.slug}`} className="block">
      <Card
        className="h-full animate-in fade-in slide-in-from-bottom-2 fill-mode-both transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/25"
        style={{ animationDelay: `${Math.min(index, 10) * 40}ms`, animationDuration: "400ms" }}
      >
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
    </a>
  );
}
