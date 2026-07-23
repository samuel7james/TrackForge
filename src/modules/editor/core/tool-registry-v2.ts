import { Box, Eraser, MousePointer2, Spline } from "lucide-react";
import type { ComponentType } from "react";

// EditorToolDefinition used to live in tool-registry.ts (v1, deleted in the
// engine-swap cleanup) -- this is its only remaining home now.
export interface EditorToolDefinition {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  shortcut: string;
}

// "road"+"terrain" (v1's tools) become a single auto-tiling "tile" tool plus
// a separate "erase" (the reference's own editor.html keeps these as two
// distinct toolbar buttons rather than one tool with a modifier key, so
// this mirrors that rather than inventing a different UX).
export const TOOLS_V2: EditorToolDefinition[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "v" },
  { id: "tile", label: "Road", icon: Spline, shortcut: "g" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "object", label: "Object", icon: Box, shortcut: "o" },
];
