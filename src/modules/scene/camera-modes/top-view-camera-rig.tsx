"use client";

import { MapControls, OrthographicCamera } from "@react-three/drei";
import { useEditorStore } from "@/store/editor-store";

// A clean top-down orthographic view -- pan and zoom only, no rotation --
// directly inspired by mrdoob's Starter-Kit-Racing track editor, which
// edits tracks from exactly this kind of flat, precise, non-perspective
// viewpoint. MapControls is drei's ready-made fit: the same OrbitControls
// machinery with mouse buttons remapped for panning a flat view, so no
// custom pan/zoom math is needed.
export function TopViewCameraRig() {
  // MapControls pans on left-drag, same button control-point/object dragging
  // uses -- disabled mid-drag exactly like the orbit rig disables
  // OrbitControls, for the same reason (its native listeners bind directly
  // to the canvas, so stopping propagation on the drag handler alone
  // wouldn't stop it from also panning the camera).
  const isDraggingControlPoint = useEditorStore((s) => s.isDraggingControlPoint);

  // Height is deliberately modest -- an orthographic camera's visible area
  // is controlled by zoom, not distance, but *fog* still cares about actual
  // distance from the camera regardless of projection type. A camera at
  // y=200 put enough air between it and the ground for FogExp2 to wash the
  // whole view out to a haze (verified: ~70% fogged at the default Clear
  // Day density). Staying low keeps the view clear while zoom still governs
  // how much ground is visible.
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 45, 0]} zoom={8} near={0.1} far={1000} />
      <MapControls
        makeDefault
        enabled={!isDraggingControlPoint}
        enableRotate={false}
        minZoom={2}
        maxZoom={40}
        screenSpacePanning
      />
    </>
  );
}
