import { create } from "zustand";
import type { PropType } from "@/modules/objects/prop-registry";

interface PropPaletteState {
  selectedType: PropType;
  setSelectedType: (type: PropType) => void;
}

export const usePropPaletteStore = create<PropPaletteState>((set) => ({
  selectedType: "cone",
  setSelectedType: (selectedType) => set({ selectedType }),
}));
