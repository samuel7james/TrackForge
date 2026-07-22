"use client";

import { Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";

export function ModeToggle() {
  const mode = useEditorStore((s) => s.mode);
  const toggleMode = useEditorStore((s) => s.toggleMode);

  return (
    <Button onClick={toggleMode} size="sm" className="gap-1.5">
      {mode === "edit" ? (
        <>
          <Play className="size-4" />
          Play
        </>
      ) : (
        <>
          <Pencil className="size-4" />
          Edit
        </>
      )}
    </Button>
  );
}
