import { create } from "zustand";

interface UiState {
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isPublishDialogOpen: boolean;
  setPublishDialogOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  isPublishDialogOpen: false,
  setPublishDialogOpen: (open) => set({ isPublishDialogOpen: open }),
}));
