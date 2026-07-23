import * as THREE from "three";
import { vehicleHandle } from "./vehicle-ref";

// Baked local offsets from vehicle-truck-red.glb's own node translations
// (read directly from the GLB's JSON chunk -- see car-model.tsx) -- rear
// wheels never rotate for steering, so unlike the front wheels their world
// position is just the body's own transform applied to a fixed local point,
// with no per-frame steer angle to account for.
const REAR_LEFT_OFFSET = new THREE.Vector3(0.55, 0.3, -0.657);
const REAR_RIGHT_OFFSET = new THREE.Vector3(-0.55, 0.3, -0.657);

// Shared by DriftMarks and TireSmoke -- both need "where are the back tires
// right now, in world space" every frame, and both read it off vehicleHandle
// directly (same pattern PlayModeCameraRig already uses) rather than reaching
// into CarModel's own wheel refs, which live in a different component and
// aren't meant to be read from outside it.
export function updateRearWheelWorldPositions(
  blOut: THREE.Vector3,
  brOut: THREE.Vector3
): boolean {
  const body = vehicleHandle.current;
  if (!body) return false;

  const t = body.translation();
  const r = body.rotation();
  const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const position = new THREE.Vector3(t.x, t.y, t.z);

  blOut.copy(REAR_LEFT_OFFSET).applyQuaternion(quat).add(position);
  brOut.copy(REAR_RIGHT_OFFSET).applyQuaternion(quat).add(position);
  return true;
}
