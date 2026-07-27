import Link from "next/link";
import { Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex animate-in fade-in slide-in-from-bottom-4 flex-col items-center gap-4 duration-700">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          TrackForge
        </h1>
        <p className="max-w-md text-balance text-lg text-muted-foreground">
          Design race tracks and drive them instantly all in the browser.
        </p>
      </div>
      <div
        className="flex animate-in fade-in slide-in-from-bottom-4 fill-mode-both flex-col items-center gap-3 duration-700 sm:flex-row"
        style={{ animationDelay: "150ms" }}
      >
        <Button
          size="lg"
          className="gap-2 transition-transform hover:scale-105"
          nativeButton={false}
          render={<Link href="/editor/new" />}
        >
          <Sparkles className="size-4" />
          Create a new track
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2 transition-transform hover:scale-105"
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
