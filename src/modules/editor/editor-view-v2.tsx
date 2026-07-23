"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackForgeCanvasV2 } from "@/modules/scene/track-forge-canvas-v2";
import { EngineMount } from "@/modules/game-engine/engine-mount";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { PropPalettePanel } from "@/modules/editor/ui/prop-palette-panel";
import { SaveButton } from "@/modules/editor/ui/save-button";
import { PublishShareButton } from "@/modules/editor/ui/publish-share-button";
import { ResetTrackButton } from "@/modules/editor/ui/reset-track-button";
import { useEditorStore } from "@/store/editor-store";
import { useTrackStoreV2 } from "@/store/track-store-v2";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { useAutosaveV2 } from "@/modules/track-format/use-autosave-v2";
import { useSaveTrackV2 } from "@/modules/track-format/use-save-track-v2";
import { TOOLS_V2 } from "@/modules/editor/core/tool-registry-v2";
import type { TrackDocumentV2 } from "@/modules/track-format/schema";

interface EditorViewV2Props {
  slug: string | null;
  /** Already fetched+validated by EditorView; omitted for a brand-new track
   * (no slug yet), in which case the store's own default empty document is
   * used as-is. */
  document?: TrackDocumentV2;
  /** A track's public page links here with ?autoplay=1 so a visitor lands
   * directly in the driver's seat instead of the editor. */
  autoplay?: boolean;
  /** Whether the fetched track was already published -- ignored for a
   * brand-new track (always starts unpublished). */
  initiallyPublished?: boolean;
}

// TrackForge's one editor UI (the old spline/heightmap one and its R3F/
// Rapier rendering stack were deleted in the engine-swap cleanup). Scoped
// down from that old UI in a few ways that are deliberately deferred, not
// silently dropped: no InspectorPanel/TerrainBrushPanel-equivalent (nothing
// to inspect -- no spline points or heightmap), no UndoRedoControls/
// CommandPalette (TileGridLayer mutates the store directly rather than
// through useCommandStack, so there's nothing for them to act on yet).
export function EditorViewV2({ slug, document, autoplay, initiallyPublished }: EditorViewV2Props) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);
  const trackName = useTrackStoreV2((s) => s.document.meta.name);
  const cells = useTrackStoreV2((s) => s.document.track.cells);
  const objects = useTrackStoreV2((s) => s.document.objects);

  useAutosaveV2();
  const saveTrack = useSaveTrackV2();

  // Fresh editor session: load the given document (or keep the store's
  // default empty one for a brand-new track), reset undo history, and
  // default to the road tool.
  useEffect(() => {
    if (document) useTrackStoreV2.getState().loadDocument(document);
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

  // See v1's identical comment this was ported from: this is also the one
  // place a "real play" (as opposed to the owner testing their own track
  // from inside the editor) is unambiguous, so it's the spot that
  // increments the public playCount -- fire-and-forget, a failed count
  // bump shouldn't block or error out the drive.
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
        <TrackForgeCanvasV2 />
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
                <PublishShareButton initiallyPublished={initiallyPublished ?? false} />
                <ResetTrackButton />
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
                <Toolbar tools={TOOLS_V2} />
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
