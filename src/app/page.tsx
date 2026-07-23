import Link from "next/link";
import { Compass, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEMO_TRACK_SLUG = "azure-delta-thu9";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Now building — Milestone 4
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          TrackForge
        </h1>
        <p className="max-w-md text-balance text-lg text-muted-foreground">
          Design race tracks tile by tile, place scenery and obstacles, and drive
          them instantly — all in the browser.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button
          size="lg"
          className="gap-2"
          nativeButton={false}
          render={<Link href={`/t/${DEMO_TRACK_SLUG}`} />}
        >
          <Play className="size-4" />
          Play
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          nativeButton={false}
          render={<Link href="/editor/new" />}
        >
          <Sparkles className="size-4" />
          Create a new track
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          nativeButton={false}
          render={<Link href="/discover" />}
        >
          <Compass className="size-4" />
          Discover tracks
        </Button>
      </div>
    </div>
  );
}
