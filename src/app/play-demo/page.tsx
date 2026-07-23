import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { EngineMount } from "@/modules/game-engine/engine-mount";

interface PlayDemoPageProps {
  searchParams: Promise<{ slug?: string }>;
}

// Throwaway route for the engine-swap work (see the plan at
// C:\Users\samue\.claude\plans\immutable-questing-cocke.md): proves the
// vendored engine renders/drives/plays audio correctly inside a real Next.js
// page before the real editor/play routes get rewired onto it (Phase 5/6).
// Not linked from anywhere in the app nav. With no `?slug=`, plays the
// reference's own built-in demo grid (Phase 1); with `?slug=`, fetches a
// real v2 track document and feeds its cells/objects into the engine
// (Phase 4) -- the same round trip the real play route will do once wired.
export default async function PlayDemoPage({ searchParams }: PlayDemoPageProps) {
  const { slug } = await searchParams;

  let mapCells = null;
  let objects: import("@/modules/track-format/schema").PlacedObject[] = [];
  let trackId: string | null = null;
  let loadError: string | null = null;

  if (slug) {
    const track = await prisma.track.findUnique({ where: { slug } });
    if (!track) {
      loadError = `No track found for slug "${slug}"`;
    } else {
      const parsed = safeParseTrackDocument(track.document);
      if (!parsed.success) {
        loadError = "This track's data is corrupted";
      } else if (parsed.data.formatVersion !== 2) {
        loadError = "This track uses the old spline format -- open it in /editor instead";
      } else {
        mapCells = parsed.data.track.cells;
        objects = parsed.data.objects;
        trackId = slug;
      }
    }
  }

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-background">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-end p-4">
        <div className="pointer-events-auto rounded-full border border-border/50 bg-card/90 px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur-xl">
          TrackForge <span className="font-normal text-muted-foreground">/ Engine Demo</span>
        </div>
      </header>
      {loadError ? (
        <div className="flex h-full items-center justify-center text-destructive">{loadError}</div>
      ) : (
        <EngineMount key={slug ?? "demo"} mapCells={mapCells} objects={objects} trackId={trackId} />
      )}
    </div>
  );
}
