"use client";

import { useEditorStore } from "@/store/editor-store";
import { RoadEditingLayer } from "@/modules/editor/tools/road-editing-layer";
import { EditorCameraRig } from "./editor-camera-rig";
import { PlayModeCameraRig } from "./play-mode-camera-rig";

// Swaps camera rig + controller subtree on mode change. SceneRoot is never
// touched, which is what makes the edit/play switch instant (PROJECT_PLAN.md §10).
// Editing interactions (RoadEditingLayer) only mount in edit mode.
export function ModeController() {
  const mode = useEditorStore((s) => s.mode);

  if (mode === "edit") {
    return (
      <>
        <EditorCameraRig />
        <RoadEditingLayer />
      </>
    );
  }

  return <PlayModeCameraRig />;
}
