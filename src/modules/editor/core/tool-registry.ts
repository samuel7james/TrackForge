import { Box, Eraser, MousePointer2, Spline } from "lucide-react";
import type { ComponentType } from "react";

export interface EditorToolDefinition {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  shortcut: string;
}

// A single auto-tiling "tile" tool plus a separate "erase" (the reference
// editor.html this was ported from keeps these as two distinct toolbar
// buttons rather than one tool with a modifier key, so this mirrors that
// rather than inventing a different UX).
export const TOOLS: EditorToolDefinition[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "v" },
  { id: "tile", label: "Road", icon: Spline, shortcut: "g" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "object", label: "Object", icon: Box, shortcut: "o" },
];
