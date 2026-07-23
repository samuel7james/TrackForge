import * as THREE from "three";

// "Trauma" model (Squirrel Eiserloh's GDC talk on screen shake): a single
// 0..1 value that decays every frame, with the actual shake offset scaled by
// trauma^2 so small knocks barely register but big hits ramp up sharply.
// Plain mutable object, same pattern as vehicle-visual-state.ts -- written
// once per impact from Vehicle's collision handler, read/decayed every frame
// by PlayModeCameraRig, no React state or re-render involved.
export const cameraShakeState = {
  trauma: 0,
};

export function addCameraShake(amount: number) {
  cameraShakeState.trauma = THREE.MathUtils.clamp(cameraShakeState.trauma + amount, 0, 1);
}
