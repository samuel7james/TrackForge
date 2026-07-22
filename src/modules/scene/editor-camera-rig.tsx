"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useEditorStore } from "@/store/editor-store";

export function EditorCameraRig() {
  const isDraggingControlPoint = useEditorStore((s) => s.isDraggingControlPoint);

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
