"use client";

import { Physics } from "@react-three/rapier";
import { useEditorStore } from "@/store/editor-store";
import { EditorEngine } from "@/modules/editor/core/editor-engine";
import { TrackPhysics } from "@/modules/race/physics/track-physics";
import { ObjectPhysics } from "@/modules/race/physics/object-physics";
import { Vehicle } from "@/modules/race/vehicle/vehicle";
import { LapTimer } from "@/modules/race/timing/lap-timer";
import { EditorCameraRig } from "./editor-camera-rig";
import { PlayModeCameraRig } from "./play-mode-camera-rig";

// Swaps camera rig + controller subtree on mode change. SceneRoot is never
// touched, which is what makes the edit/play switch instant (PROJECT_PLAN.md §10).
// EditorEngine (tool shortcuts + active tool's interaction layer) only mounts
// in edit mode; the Rapier world only mounts in play mode (PROJECT_PLAN.md §4) —
// each Play press starts the vehicle fresh at the start line.
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

  return (
    <Physics>
      <TrackPhysics />
      <ObjectPhysics />
      <Vehicle />
      <LapTimer />
      <PlayModeCameraRig />
    </Physics>
  );
}
