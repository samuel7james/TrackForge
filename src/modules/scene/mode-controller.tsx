"use client";

import { useEditorStore } from "@/store/editor-store";
import { EditorEngine } from "@/modules/editor/core/editor-engine";
import { EditorCameraRig } from "./editor-camera-rig";
import { PlayModeCameraRig } from "./play-mode-camera-rig";

// Swaps camera rig + controller subtree on mode change. SceneRoot is never
// touched, which is what makes the edit/play switch instant (PROJECT_PLAN.md §10).
// EditorEngine (tool shortcuts + active tool's interaction layer) only mounts
// in edit mode.
export function ModeController() {
  const mode = useEditorStore((s) => s.mode);

  if (mode === "edit") {
    return (
      <>
        <EditorCameraRig />
        <EditorEngine />
      </>
    );
  }

  return <PlayModeCameraRig />;
}
