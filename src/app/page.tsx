import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Now building — Milestone 1
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          TrackForge
        </h1>
        <p className="max-w-md text-balance text-lg text-muted-foreground">
          Design race tracks with splines, drive them instantly, and share a link
          — all in the browser.
        </p>
      </div>
      <Button size="lg" render={<Link href="/editor/new" />}>
        Open the editor
      </Button>
    </div>
  );
}
