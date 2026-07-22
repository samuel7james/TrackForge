import { create } from "zustand";

export type EditorMode = "edit" | "play";

interface EditorState {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: "edit",
  setMode: (mode) => set({ mode }),
  toggleMode: () => set({ mode: get().mode === "edit" ? "play" : "edit" }),
}));
