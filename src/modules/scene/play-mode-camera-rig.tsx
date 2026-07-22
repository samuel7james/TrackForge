"use client";

import { PerspectiveCamera } from "@react-three/drei";

// Temporary static rig so mode-switching can be validated end-to-end now.
// Replaced by the chase-cam + vehicle controller in Phase 6.
export function PlayModeCameraRig() {
  return <PerspectiveCamera makeDefault position={[0, 6, 14]} fov={60} />;
}
