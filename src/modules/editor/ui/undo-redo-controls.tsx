"use client";

import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommandStack } from "@/modules/editor/core/command-stack";

export function UndoRedoControls() {
  const canUndo = useCommandStack((s) => s.canUndo);
  const canRedo = useCommandStack((s) => s.canRedo);
  const undo = useCommandStack((s) => s.undo);
  const redo = useCommandStack((s) => s.redo);

  return (
    <div className="flex items-center gap-1 border-l border-border/50 pl-3">
      <Button
        size="icon"
        variant="ghost"
        disabled={!canUndo}
        onClick={undo}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={!canRedo}
        onClick={redo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="size-4" />
      </Button>
    </div>
  );
}
