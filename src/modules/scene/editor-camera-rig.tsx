"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEditorStore } from "@/store/editor-store";
import { FreeFlyCameraRig } from "./camera-modes/free-fly-camera-rig";
import { TopViewCameraRig } from "./camera-modes/top-view-camera-rig";
import { CinematicCameraRig } from "./camera-modes/cinematic-camera-rig";

// Orbit is the original/default rig; Free Fly, Top View, and Cinematic
// (Phase 15) are separate self-contained rigs swapped in based on
// cameraMode -- each owns its own camera + controls, so switching modes is
// just mounting a different one, the same "swap the subtree, not the
// scene" pattern ModeController already uses for edit/play.
export function EditorCameraRig() {
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const isDraggingControlPoint = useEditorStore((s) => s.isDraggingControlPoint);

  if (cameraMode === "freefly") return <FreeFlyCameraRig />;
  if (cameraMode === "topview") return <TopViewCameraRig />;
  if (cameraMode === "cinematic") return <CinematicCameraRig />;

  return (
    <>
      <PerspectiveCamera makeDefault position={[18, 14, 18]} fov={50} />
      <OrbitControls
        makeDefault
        enabled={!isDraggingControlPoint}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
    </>
  );
}
