"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEditorStore } from "@/store/editor-store";
import { FreeFlyCameraRig } from "./camera-modes/free-fly-camera-rig";
import { TopViewCameraRig } from "./camera-modes/top-view-camera-rig";

// Orbit is the original/default rig; Free Fly and Top View are separate
// self-contained rigs swapped in based on cameraMode -- each owns its own
// camera + controls, so switching modes is just mounting a different one.
// A "cinematic" mode also existed (a scripted flythrough sampling the old
// spline's centerline) but was deleted in the engine-swap cleanup along
// with the rest of the spline system it depended on -- there's no
// equivalent path-through-connected-cells version yet for the tile-based
// format, and no UI currently exposes switching to it anyway
// (CameraModeMenu was deferred, not wired into the new editor's UI).
export function EditorCameraRig() {
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const isDraggingControlPoint = useEditorStore((s) => s.isDraggingControlPoint);

  if (cameraMode === "freefly") return <FreeFlyCameraRig />;
  if (cameraMode === "topview") return <TopViewCameraRig />;

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
