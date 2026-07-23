"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { TrackForgeCanvasV2 } from "@/modules/scene/track-forge-canvas-v2";
import { EngineMount } from "@/modules/game-engine/engine-mount";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { PropPalettePanel } from "@/modules/editor/ui/prop-palette-panel";
import { SaveButton } from "@/modules/editor/ui/save-button";
import { useEditorStore } from "@/store/editor-store";
import { useTrackStoreV2 } from "@/store/track-store-v2";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { useAutosaveV2 } from "@/modules/track-format/use-autosave-v2";
import { useSaveTrackV2 } from "@/modules/track-format/use-save-track-v2";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { TOOLS_V2 } from "@/modules/editor/core/tool-registry-v2";
import type { TrackDocumentV2 } from "@/modules/track-format/schema";

interface EditorViewV2Props {
  slug: string | null;
  /** Already-fetched+validated document, when EditorView determined the
   * format server-round-trip itself and handed off here to avoid a second
   * fetch. */
  initialDocument?: TrackDocumentV2;
}

// Parallel to editor-view.tsx (v1) for the tile-based track format. Scoped
// down from v1's UI for this pass: no InspectorPanel/TerrainBrushPanel (no
// spline points or heightmap to inspect), no PublishDialog (the publish
// route itself returns 501 for v2 documents until tile-based layout
// validators exist -- Phase 3/4 of the engine-swap work), no
// UndoRedoControls/CommandPalette (TileGridLayer doesn't push onto
// useCommandStack yet, so there'd be nothing for them to do). These are
// deliberately deferred, not silently dropped.
export function EditorViewV2({ slug, initialDocument }: EditorViewV2Props) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);
  const trackName = useTrackStoreV2((s) => s.document.meta.name);
  const cells = useTrackStoreV2((s) => s.document.track.cells);
  const objects = useTrackStoreV2((s) => s.document.objects);
  const [isLoading, setIsLoading] = useState(Boolean(slug) && !initialDocument);

  useAutosaveV2();
  const saveTrack = useSaveTrackV2();

  // Fresh tile editor session: reset undo history (format-agnostic stack,
  // shared with v1 -- avoids a prior v1 session's entries lingering) and
  // default to the road tool rather than whatever v1 last left active.
  useEffect(() => {
    useCommandStack.getState().reset();
    setActiveToolId("tile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialDocument) {
      useTrackStoreV2.getState().loadDocument(initialDocument);
      return;
    }
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
        if (parsed.data.formatVersion !== 2) {
          throw new Error("This track uses the old format -- open it from /editor instead");
        }
        useTrackStoreV2.getState().loadDocument(parsed.data);
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
  }, [slug, initialDocument]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "play") setMode("edit");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, setMode]);

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
            {mode === "edit" && <SaveButton saveTrack={saveTrack} />}
          </div>
          <ModeToggle />
        </header>

        {isLoading && (
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            Loading track…
          </p>
        )}

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
        </AnimatePresence>
      </div>
    </div>
  );
}
