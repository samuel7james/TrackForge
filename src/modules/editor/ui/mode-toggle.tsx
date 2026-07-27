"use client";

import { Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editor-store";

// allowEdit=false (the daily challenge -- see track-editor.tsx) hides the
// switch-back-to-edit affordance entirely once in Play mode: there's no
// real owner who could ever save changes to that track (its editToken is
// never exposed to any client), so offering an "Edit" button that leads
// nowhere useful is just a confusing dead end.
export function ModeToggle({ allowEdit = true }: { allowEdit?: boolean }) {
  const mode = useEditorStore((s) => s.mode);
  const toggleMode = useEditorStore((s) => s.toggleMode);

  if (mode === "play" && !allowEdit) return null;

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
