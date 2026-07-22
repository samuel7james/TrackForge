"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

export function EditorCameraRig() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[18, 14, 18]} fov={50} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
    </>
  );
}
