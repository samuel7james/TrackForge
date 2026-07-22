import { create } from "zustand";
import type { ToolMode } from "@/modules/terrain/heightmap";
import type { TerrainTextureLayer } from "@/modules/track-format/schema";

interface TerrainBrushState {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
  radiusCells: number;
  setRadiusCells: (radius: number) => void;
  strength: number;
  setStrength: (strength: number) => void;
  paintLayer: TerrainTextureLayer["type"];
  setPaintLayer: (type: TerrainTextureLayer["type"]) => void;
}

export const useTerrainBrushStore = create<TerrainBrushState>((set) => ({
  mode: "raise",
  setMode: (mode) => set({ mode }),
  radiusCells: 4,
  setRadiusCells: (radiusCells) => set({ radiusCells }),
  strength: 0.5,
  setStrength: (strength) => set({ strength }),
  paintLayer: "dirt",
  setPaintLayer: (paintLayer) => set({ paintLayer }),
}));
