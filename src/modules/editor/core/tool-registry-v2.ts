import { Box, Eraser, MousePointer2, Spline } from "lucide-react";
import type { EditorToolDefinition } from "./tool-registry";

// Parallel to tool-registry.ts (v1) -- "road"+"terrain" become a single
// auto-tiling "tile" tool plus a separate "erase" (the reference's own
// editor.html keeps these as two distinct toolbar buttons rather than one
// tool with a modifier key, so this mirrors that rather than inventing a
// different UX). "object"/"select" carry the same ids as v1 since
// tile-grid-layer.tsx's interaction logic plays the same role as v1's
// ObjectPlacementLayer for those two.
export const TOOLS_V2: EditorToolDefinition[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "v" },
  { id: "tile", label: "Road", icon: Spline, shortcut: "g" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "object", label: "Object", icon: Box, shortcut: "o" },
];
