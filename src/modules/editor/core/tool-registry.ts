import { MousePointer2, Mountain, Spline } from "lucide-react";
import type { ComponentType } from "react";

export interface EditorToolDefinition {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  shortcut: string;
}

// Adding a tool means adding an entry here (plus its behavior in
// PointEditingLayer / a future tool-specific layer) — never a switch
// statement keyed on tool id.
export const TOOLS: EditorToolDefinition[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "v" },
  { id: "road", label: "Road", icon: Spline, shortcut: "g" },
  { id: "terrain", label: "Terrain", icon: Mountain, shortcut: "t" },
];
