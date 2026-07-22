"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrackForgeCanvas } from "@/modules/scene/track-forge-canvas";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { InspectorPanel } from "@/modules/editor/ui/inspector-panel";
import { UndoRedoControls } from "@/modules/editor/ui/undo-redo-controls";
import { TrackStatus } from "@/modules/editor/ui/track-status";
import { SaveButton } from "@/modules/editor/ui/save-button";
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
            {mode === "edit" && (
              <>
                <UndoRedoControls />
                <TrackStatus />
                <SaveButton />
              </>
            )}
          </div>
          <ModeToggle />
        </header>

        {isLoading && (
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            Loading track…
          </p>
        )}

        {mode === "edit" && (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Toolbar />
            </div>
            <div className="absolute right-4 top-20">
              <InspectorPanel />
            </div>
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
              {activeToolId === "road"
                ? "Road tool: click ground to add a point · drag to move · select + Delete to remove"
                : "Select tool: drag a point to move it · select + Delete to remove"}{" "}
              · V/G switch tools · Ctrl+Z / Ctrl+Shift+Z undo/redo
            </p>
          </>
        )}
        {mode === "play" && (
          <>
            <RaceHud />
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
              WASD / arrows to drive · Esc to return to editing
            </p>
          </>
        )}
      </div>
    </div>
  );
}
