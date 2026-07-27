"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrackStore } from "@/store/track-store";
import { placeFinishCell, gridToCells } from "@/modules/game-engine/autotile";

// Wipes the track back to a single finish cell -- for when a session has
// gone sideways and starting over is faster than manually erasing
// everything. Native confirm() rather than a themed dialog since this is
// the one genuinely destructive, no-undo action in the editor
// (TileGridLayer doesn't push onto the command stack yet, see its own
// comment on why) and a plain browser prompt reads as appropriately blunt
// for that.
export function ResetTrackButton() {
  const setCells = useTrackStore((s) => s.setCells);

  const handleReset = () => {
    if (!window.confirm("Clear the whole track and start over? This can't be undone.")) return;
    setCells(gridToCells(placeFinishCell(new Map(), 0, 0)));
  };

  return (
    <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
      <Trash2 className="size-4" />
      Reset
    </Button>
  );
}
