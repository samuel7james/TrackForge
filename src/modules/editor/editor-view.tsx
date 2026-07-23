"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { TrackForgeCanvas } from "@/modules/scene/track-forge-canvas";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { InspectorPanel } from "@/modules/editor/ui/inspector-panel";
import { TerrainBrushPanel } from "@/modules/editor/ui/terrain-brush-panel";
import { PropInspectorPanel } from "@/modules/editor/ui/prop-inspector-panel";
import { PropPalettePanel } from "@/modules/editor/ui/prop-palette-panel";
import { UndoRedoControls } from "@/modules/editor/ui/undo-redo-controls";
import { TrackStatus } from "@/modules/editor/ui/track-status";
import { SaveButton } from "@/modules/editor/ui/save-button";
import { PublishDialog } from "@/modules/editor/ui/publish-dialog";
import { EnvironmentDialog } from "@/modules/editor/ui/environment-dialog";
import { CameraModeMenu } from "@/modules/editor/ui/camera-mode-menu";
import { EmptyStateHint } from "@/modules/editor/ui/empty-state-hint";
import { CommandPalette } from "@/modules/editor/ui/command-palette";
import { RaceHud } from "@/modules/race/timing/race-hud";
import { useEditorStore } from "@/store/editor-store";
import { useTrackStore } from "@/store/track-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { useAutosave } from "@/modules/track-format/use-autosave";
import { safeParseTrackDocument } from "@/modules/track-format/validate";

interface EditorViewProps {
  slug: string | null;
}

export function EditorView({ slug }: EditorViewProps) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const trackName = useTrackStore((s) => s.document.meta.name);
  const [isLoading, setIsLoading] = useState(Boolean(slug));
  const searchParams = useSearchParams();
  const autoplay = searchParams.get("autoplay") === "1";

  useAutosave();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "play") {
        setMode("edit");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, setMode]);

  // Reload flow: an existing track loads its saved document on mount and
  // resets undo history (a fresh load isn't something a prior session's
  // undo stack should be able to unwind).
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    fetch(`/api/tracks/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Track not found");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = safeParseTrackDocument(data.document);
        if (!parsed.success) throw new Error("This track's data is corrupted");
        // This editor (spline/heightmap-based) only understands v1 documents
        // -- the tile-based format (v2) gets its own editor (Phase 5 of the
        // engine-swap work), not a migration path back into this one.
        if (parsed.data.formatVersion !== 1) {
          throw new Error("This track uses a format this editor doesn't support yet");
        }
        useTrackStore.getState().loadDocument(parsed.data);
        useCommandStack.getState().reset();
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load track");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // "Play" CTA on a track's public page links here with ?autoplay=1 so a
  // visitor lands directly in the driver's seat instead of the editor. This
  // is also the one place a "real play" (as opposed to the owner testing
  // their own track from inside the editor) is unambiguous, so it's the spot
  // that increments the public playCount (Phase 17) -- fire-and-forget, a
  // failed count bump shouldn't block or error out the drive.
  useEffect(() => {
    if (autoplay && !isLoading) {
      setMode("play");
      if (slug) {
        fetch(`/api/tracks/${slug}/play`, { method: "POST" }).catch(() => {});
      }
    }
  }, [autoplay, isLoading, setMode, slug]);

  return (
    <div className="fixed inset-0">
      <TrackForgeCanvas />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium tracking-tight text-foreground/90">
              TrackForge
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{trackName}</span>
            <AnimatePresence mode="popLayout">
              {mode === "edit" && (
                <motion.div
                  key="edit-controls"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3"
                >
                  <UndoRedoControls />
                  <TrackStatus />
                  <CameraModeMenu />
                  <EnvironmentDialog />
                  <SaveButton />
                  <PublishDialog />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ModeToggle />
        </header>

        {isLoading && (
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            Loading track…
          </p>
        )}

        {mode === "edit" && <EmptyStateHint />}

        <AnimatePresence mode="wait">
          {mode === "edit" && (
            <motion.div
              key="edit-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2"
              >
                <Toolbar />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="pointer-events-auto absolute right-4 top-20"
              >
                <InspectorPanel />
                <TerrainBrushPanel />
                <PropPalettePanel />
                <PropInspectorPanel />
              </motion.div>
              <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                {activeToolId === "road"
                  ? "Road tool: click ground to add a point (Shift angle-snap, Ctrl grid-snap) · drag to move · select + Delete to remove"
                  : activeToolId === "terrain"
                    ? "Terrain tool: drag to sculpt or paint · pick a brush and radius/strength in the panel"
                    : activeToolId === "object"
                      ? "Object tool: pick a prop, click the ground to place it · drag to move · select + Delete to remove"
                      : "Select tool: drag a point to move it · click the road to split it · select + Delete to remove"}{" "}
                · V/G/T/O switch tools · Ctrl+Z / Ctrl+Shift+Z undo/redo · Ctrl+K commands
              </p>
            </motion.div>
          )}
          {mode === "play" && (
            <motion.div
              key="play-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <RaceHud />
              <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                WASD / arrows to drive · Esc to return to editing
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CommandPalette />
    </div>
  );
}
