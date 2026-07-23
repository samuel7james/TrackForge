"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { TOOLS_V2 } from "./tool-registry-v2";
import { TileGridLayer } from "@/modules/editor/tools/tile-grid-layer";

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

// Parallel to editor-engine.tsx (v1) -- owns tool-shortcut switching for the
// tile editor's own tool set. No undo/redo shortcut yet: TileGridLayer
// mutates the v2 store directly rather than through useCommandStack (see
// its own comment on why), so there's nothing for Ctrl+Z to do yet.
export function EditorEngineV2() {
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingIntoField(e.target)) return;
      const tool = TOOLS_V2.find((t) => t.shortcut === e.key.toLowerCase());
      if (tool) setActiveToolId(tool.id);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveToolId]);

  return <TileGridLayer />;
}
