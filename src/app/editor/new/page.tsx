"use client";

import { useEffect } from "react";
import { TrackForgeCanvas } from "@/modules/scene/track-forge-canvas";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { useEditorStore } from "@/store/editor-store";

export default function NewTrackEditorPage() {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);

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
          <span className="text-sm font-medium tracking-tight text-foreground/90">
            TrackForge
          </span>
          <ModeToggle />
        </header>

        {mode === "play" && (
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
            Press Esc to return to editing
          </p>
        )}
      </div>
    </div>
  );
}
