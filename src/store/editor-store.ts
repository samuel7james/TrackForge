import { create } from "zustand";

export type EditorMode = "edit" | "play";
export type CameraMode = "orbit" | "freefly" | "topview";

interface EditorState {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;

  // Editor-only (Play mode always uses PlayModeCameraRig regardless of this).
  // Orbit is the original/default rig; the other three are Phase 15's
  // additions -- see modules/scene/camera-modes/.
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;

  // Which tool is active — driven by the ToolRegistry, read by the toolbar
  // and by PointEditingLayer to decide whether ground-clicks add a point.
  activeToolId: string;
  setActiveToolId: (id: string) => void;

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

  cameraMode: "orbit",
  setCameraMode: (cameraMode) => set({ cameraMode }),

  activeToolId: "road",
  setActiveToolId: (id) => set({ activeToolId: id }),

  isDraggingControlPoint: false,
  setIsDraggingControlPoint: (dragging) =>
    set({ isDraggingControlPoint: dragging }),
}));
