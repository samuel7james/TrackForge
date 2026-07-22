import * as THREE from "three";
import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import type { Checkpoint, Quat, RoadSpline, Vec3 } from "./schema";

const CHECKPOINT_SPACING = 40; // meters between auto-generated checkpoints
const FORWARD = new THREE.Vector3(0, 0, 1);

export interface GeneratedStartLine {
  position: Vec3;
  rotation: Quat;
  width: number;
}

export type GeneratedCheckpoint = Checkpoint & { width: number };

function quaternionFromTangent(tangent: THREE.Vector3): Quat {
  const q = new THREE.Quaternion().setFromUnitVectors(FORWARD, tangent);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

// Start/finish is always the spline's first sample — not user-editable in
// Milestone 1, just derived from the road every time it changes.
export function generateStartLine(spline: RoadSpline): GeneratedStartLine | null {
  const samples = sampleRoadCenterline(spline.points, spline.closed);
  if (samples.length === 0) return null;
  const first = samples[0];
  return {
    position: { x: first.position.x, y: first.position.y, z: first.position.z },
    rotation: quaternionFromTangent(first.tangent),
    width: first.width,
  };
}

// Evenly spaced along arc length, starting one spacing interval after the
// start/finish line — order follows arc length, so it's inherently sequential.
export function generateCheckpoints(spline: RoadSpline): GeneratedCheckpoint[] {
  const samples = sampleRoadCenterline(spline.points, spline.closed);
  if (samples.length < 2) return [];

  const cumulative: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    cumulative.push(
      cumulative[i - 1] + samples[i].position.distanceTo(samples[i - 1].position)
    );
  }
  const totalLength = cumulative[cumulative.length - 1];
  if (totalLength < CHECKPOINT_SPACING) return [];

  const checkpoints: GeneratedCheckpoint[] = [];
  let order = 0;
  for (let dist = CHECKPOINT_SPACING; dist < totalLength; dist += CHECKPOINT_SPACING) {
    const sampleIndex = cumulative.findIndex((d) => d >= dist);
    if (sampleIndex <= 0) continue;
    const sample = samples[sampleIndex];
    checkpoints.push({
      id: `checkpoint-${order}`,
      position: { x: sample.position.x, y: sample.position.y, z: sample.position.z },
      rotation: quaternionFromTangent(sample.tangent),
      order,
      width: sample.width,
    });
    order += 1;
  }
  return checkpoints;
}
