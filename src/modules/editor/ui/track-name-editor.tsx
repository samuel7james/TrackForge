"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useTrackStore } from "@/store/track-store";

// Renaming is one of the few things every track owner keeps -- it's not a
// destructive/moderation power, just editing your own draft's metadata,
// same trust level as moving tiles around. setMeta's change flows through
// the existing autosave subscription (use-autosave.ts already saves on any
// document change), so there's no separate save call needed here.
export function TrackNameEditor() {
  const name = useTrackStore((s) => s.document.meta.name);
  const setMeta = useTrackStore((s) => s.setMeta);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commit = () => {
    setMeta({ name: draft.trim() || "Untitled Track" });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(name);
            setIsEditing(false);
          }
        }}
        className="w-40 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-sm text-foreground"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name);
        setIsEditing(true);
      }}
      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
      title="Rename track"
    >
      {name}
      <Pencil className="size-3" />
    </button>
  );
}
