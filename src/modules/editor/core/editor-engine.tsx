"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "./command-stack";
import { TOOLS } from "./tool-registry";
import { PointEditingLayer } from "@/modules/editor/tools/point-editing-layer";
import { TangentHandles } from "@/modules/editor/tools/tangent-handles";
import { ElevationHandle } from "@/modules/editor/tools/elevation-handle";
import { TerrainSculptLayer } from "@/modules/editor/tools/terrain-sculpt-layer";

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

// Owns editor-wide keyboard shortcuts (tool switching, undo/redo) and mounts
// the active tool's interaction layer. Only present in edit mode — undo/redo
// and tool switching don't apply while driving.
export function EditorEngine() {
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);
  const undo = useCommandStack((s) => s.undo);
  const redo = useCommandStack((s) => s.redo);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingIntoField(e.target)) return;

      const isModifier = e.metaKey || e.ctrlKey;
      if (isModifier && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      const tool = TOOLS.find((t) => t.shortcut === e.key.toLowerCase());
      if (tool) setActiveToolId(tool.id);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveToolId, undo, redo]);

  return (
    <>
      <PointEditingLayer />
      <TangentHandles />
      <ElevationHandle />
      <TerrainSculptLayer />
    </>
  );
}
