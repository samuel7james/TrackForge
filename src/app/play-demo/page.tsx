import { EngineMount } from "@/modules/game-engine/engine-mount";

// Throwaway route for Phase 1 of the engine-swap work (see the plan at
// C:\Users\samue\.claude\plans\immutable-questing-cocke.md): proves the
// vendored engine renders/drives/plays audio correctly inside a real Next.js
// page before any of TrackForge's own document format, editor, or Play-mode
// wiring gets built on top of it. Not linked from anywhere in the app nav.
export default function PlayDemoPage() {
  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-background">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-end p-4">
        <div className="pointer-events-auto rounded-full border border-border/50 bg-card/90 px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur-xl">
          TrackForge <span className="font-normal text-muted-foreground">/ Engine Demo</span>
        </div>
      </header>
      <EngineMount />
    </div>
  );
}
