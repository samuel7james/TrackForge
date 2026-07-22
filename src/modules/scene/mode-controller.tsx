"use client";

import { useEditorStore } from "@/store/editor-store";
import { EditorCameraRig } from "./editor-camera-rig";
import { PlayModeCameraRig } from "./play-mode-camera-rig";

// Swaps camera rig + controller subtree on mode change. SceneRoot is never
// touched, which is what makes the edit/play switch instant (PROJECT_PLAN.md §10).
export function ModeController() {
  const mode = useEditorStore((s) => s.mode);
  return mode === "edit" ? <EditorCameraRig /> : <PlayModeCameraRig />;
}
