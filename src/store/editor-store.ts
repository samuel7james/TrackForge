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

  // Selection is cross-cutting -- one shared field for whatever's currently
  // selected (a control point, Phase 11's tangent handles, or a placed
  // object, Phase 13), rather than a separate field per entity type. IDs are
  // globally unique (crypto.randomUUID()), so each panel/tool that cares
  // just looks its own entity array up by this id and gets nothing back if
  // the current selection belongs to a different entity type -- see
  // PROJECT_PLAN.md §5.
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

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

  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),

  isDraggingControlPoint: false,
  setIsDraggingControlPoint: (dragging) =>
    set({ isDraggingControlPoint: dragging }),
}));
