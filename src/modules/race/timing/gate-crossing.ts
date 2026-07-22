import * as THREE from "three";
import type { Quat, Vec3 } from "@/modules/track-format/schema";

export interface Gate {
  position: Vec3;
  rotation: Quat;
  width: number;
}

// A distance-to-center check would miss cars passing near the edge of a
// wide gate, so this transforms both positions into the gate's local space
// (local +Z = travel direction, local +X = across the road) and checks for
// a sign change in the forward axis while the crossing point is within the
// gate's lateral bounds.
export function hasCrossedGate(
  previousWorldPos: THREE.Vector3,
  currentWorldPos: THREE.Vector3,
  gate: Gate
): boolean {
  const gatePosition = new THREE.Vector3(gate.position.x, gate.position.y, gate.position.z);
  const gateRotationInverse = new THREE.Quaternion(
    gate.rotation.x,
    gate.rotation.y,
    gate.rotation.z,
    gate.rotation.w
  ).invert();

  const previousLocal = previousWorldPos.clone().sub(gatePosition).applyQuaternion(gateRotationInverse);
  const currentLocal = currentWorldPos.clone().sub(gatePosition).applyQuaternion(gateRotationInverse);

  const crossedPlane = previousLocal.z > 0 !== currentLocal.z > 0;
  if (!crossedPlane) return false;

  const halfWidth = gate.width / 2;
  return Math.abs(currentLocal.x) <= halfWidth || Math.abs(previousLocal.x) <= halfWidth;
}
