import * as THREE from "three";
import type { RoadControlPoint } from "@/modules/track-format/schema";

export interface RoadSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  width: number;
}

const SAMPLES_PER_SEGMENT = 16;

// Auto-smoothed centerline through the control points. Arc-length
// parameterization (getPointAt/getTangentAt) keeps samples evenly spaced
// regardless of how unevenly the control points themselves are placed.
export function sampleRoadCenterline(
  points: RoadControlPoint[],
  closed: boolean
): RoadSample[] {
  if (points.length < 2) return [];

  const positions = points.map(
    (p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z)
  );
  const curve = new THREE.CatmullRomCurve3(positions, closed, "catmullrom", 0.5);

  const segmentCount = closed ? points.length : points.length - 1;
  const sampleCount = segmentCount * SAMPLES_PER_SEGMENT + 1;

  const samples: RoadSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const u = i / (sampleCount - 1);
    samples.push({
      position: curve.getPointAt(u),
      tangent: curve.getTangentAt(u).normalize(),
      width: interpolateWidth(points, closed, u),
    });
  }
  return samples;
}

function interpolateWidth(
  points: RoadControlPoint[],
  closed: boolean,
  u: number
): number {
  const segmentCount = closed ? points.length : points.length - 1;
  const scaled = u * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaled), segmentCount - 1);
  const localT = scaled - segmentIndex;
  const a = points[segmentIndex].width;
  const bIndex = closed ? (segmentIndex + 1) % points.length : segmentIndex + 1;
  const b = points[bIndex].width;
  return THREE.MathUtils.lerp(a, b, localT);
}
