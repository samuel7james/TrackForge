import { create } from "zustand";

export type EditorMode = "edit" | "play";

interface EditorState {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;

  // Which tool is active — driven by the ToolRegistry, read by the toolbar
  // and by PointEditingLayer to decide whether ground-clicks add a point.
  activeToolId: string;
  setActiveToolId: (id: string) => void;

  // Selection is cross-cutting (shared by Select/Road/Terrain/Object tools
  // once they exist) — see PROJECT_PLAN.md §5.
  selectedPointId: string | null;
  setSelectedPointId: (id: string | null) => void;

  // Read by EditorCameraRig to disable OrbitControls while a control point
  // is being dragged — OrbitControls binds its own native listeners directly
  // to the canvas, so stopping propagation on the drag handler alone doesn't
  // stop it from also rotating the camera.
  isDraggingControlPoint: boolean;
  setIsDraggingControlPoint: (dragging: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: "edit",
  setMode: (mode) => set({ mode }),
  toggleMode: () => set({ mode: get().mode === "edit" ? "play" : "edit" }),

  activeToolId: "road",
  setActiveToolId: (id) => set({ activeToolId: id }),

  selectedPointId: null,
  setSelectedPointId: (id) => set({ selectedPointId: id }),

  isDraggingControlPoint: false,
  setIsDraggingControlPoint: (dragging) =>
    set({ isDraggingControlPoint: dragging }),
}));
