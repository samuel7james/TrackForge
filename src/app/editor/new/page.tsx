"use client";

import { useEffect } from "react";
import { TrackForgeCanvas } from "@/modules/scene/track-forge-canvas";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { InspectorPanel } from "@/modules/editor/ui/inspector-panel";
import { UndoRedoControls } from "@/modules/editor/ui/undo-redo-controls";
import { TrackStatus } from "@/modules/editor/ui/track-status";
import { RaceHud } from "@/modules/race/timing/race-hud";
import { useEditorStore } from "@/store/editor-store";
import { useTrackStore } from "@/store/track-store";

export default function NewTrackEditorPage() {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const trackName = useTrackStore((s) => s.document.meta.name);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "play") {
        setMode("edit");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, setMode]);

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
              </>
            )}
          </div>
          <ModeToggle />
        </header>

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
