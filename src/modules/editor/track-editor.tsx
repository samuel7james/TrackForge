"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackForgeCanvas } from "@/modules/scene/track-forge-canvas";
import { EngineMount } from "@/modules/game-engine/engine-mount";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { PropPalettePanel } from "@/modules/editor/ui/prop-palette-panel";
import { SaveButton } from "@/modules/editor/ui/save-button";
import { PublishShareButton } from "@/modules/editor/ui/publish-share-button";
import { ResetTrackButton } from "@/modules/editor/ui/reset-track-button";
import { DeleteTrackButton } from "@/modules/editor/ui/delete-track-button";
import { useEditorStore } from "@/store/editor-store";
import { useTrackStore } from "@/store/track-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { useAutosave } from "@/modules/track-format/use-autosave";
import { useSaveTrack } from "@/modules/track-format/use-save-track";
import { TOOLS } from "@/modules/editor/core/tool-registry";
import type { TrackDocument } from "@/modules/track-format/schema";

interface TrackEditorProps {
  slug: string | null;
  /** Already fetched+validated by EditorView; omitted for a brand-new track
   * (no slug yet), in which case the store's own default empty document is
   * used as-is. */
  document?: TrackDocument;
  /** A track's public page links here with ?autoplay=1 so a visitor lands
   * directly in the driver's seat instead of the editor. */
  autoplay?: boolean;
  /** Whether the fetched track was already published -- ignored for a
   * brand-new track (always starts unpublished). */
  initiallyPublished?: boolean;
}

// TrackForge's editor UI. Deliberately scoped down in a few ways that are
// deferred, not silently dropped: no InspectorPanel/TerrainBrushPanel-
// equivalent (nothing to inspect -- no spline points or heightmap), no
// UndoRedoControls/CommandPalette (TileGridLayer mutates the store directly
// rather than through useCommandStack, so there's nothing for them to act
// on yet).
export function TrackEditor({ slug, document, autoplay, initiallyPublished }: TrackEditorProps) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);
  const trackName = useTrackStore((s) => s.document.meta.name);
  const currentSlug = useTrackStore((s) => s.document.meta.slug);
  const cells = useTrackStore((s) => s.document.track.cells);
  const objects = useTrackStore((s) => s.document.objects);

  useAutosave();
  const saveTrack = useSaveTrack();

  // Fresh editor session: load the given document (or keep the store's
  // default empty one for a brand-new track), reset undo history, and
  // default to the road tool.
  useEffect(() => {
    if (document) useTrackStore.getState().loadDocument(document);
    useCommandStack.getState().reset();
    setActiveToolId("tile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "play") setMode("edit");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, setMode]);

  // This is also the one place a "real play" (as opposed to the owner
  // testing their own track from inside the editor) is unambiguous, so it's
  // the spot that increments the public playCount -- fire-and-forget, a
  // failed count bump shouldn't block or error out the drive.
  useEffect(() => {
    if (autoplay) {
      setMode("play");
      if (slug) {
        fetch(`/api/tracks/${slug}/play`, { method: "POST" }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0">
      {mode === "edit" ? (
        <TrackForgeCanvas />
      ) : (
        <EngineMount key={slug ?? "new"} mapCells={cells} objects={objects} trackId={slug} />
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium tracking-tight text-foreground/90">TrackForge</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{trackName}</span>
            {mode === "edit" && (
              <>
                <SaveButton saveTrack={saveTrack} />
                <PublishShareButton initiallyPublished={initiallyPublished ?? false} saveTrack={saveTrack} />
                <ResetTrackButton />
                {currentSlug && <DeleteTrackButton slug={currentSlug} name={trackName} />}
              </>
            )}
          </div>
          <ModeToggle />
        </header>

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
                <Toolbar tools={TOOLS} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="pointer-events-auto absolute right-4 top-20"
              >
                <PropPalettePanel />
              </motion.div>
              <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                Road tool: click to place/auto-tile · Erase tool: click to remove · Object tool:
                pick a prop, click to place, Delete to remove selected · V/G/E/O switch tools
              </p>
            </motion.div>
          )}
          {mode === "play" && (
            <motion.p
              key="play-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
            >
              WASD / arrows to drive · Esc to return to editing
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
