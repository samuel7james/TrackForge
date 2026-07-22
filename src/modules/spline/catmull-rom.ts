import * as THREE from "three";
import type { RoadControlPoint } from "@/modules/track-format/schema";
import { RoadCurve } from "./road-curve";

export interface RoadSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  width: number;
  bank: number; // radians, rotation of the road cross-section around the tangent
}

const SAMPLES_PER_SEGMENT = 16;

// Auto-smoothed centerline through the control points, via RoadCurve (a
// Hermite spline that reduces to Catmull-Rom for "auto" points -- see
// road-curve.ts). Arc-length parameterization (getPointAt/getTangentAt)
// keeps samples evenly spaced regardless of how unevenly the control points
// themselves are placed.
export function sampleRoadCenterline(
  points: RoadControlPoint[],
  closed: boolean
): RoadSample[] {
  if (points.length < 2) return [];

  const curve = new RoadCurve(points, closed);

  const segmentCount = closed ? points.length : points.length - 1;
  const sampleCount = segmentCount * SAMPLES_PER_SEGMENT + 1;

  const samples: RoadSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const u = i / (sampleCount - 1);
    samples.push({
      position: curve.getPointAt(u),
      tangent: curve.getTangentAt(u).normalize(),
      width: interpolatePerPoint(points, closed, u, (p) => p.width),
      bank: THREE.MathUtils.degToRad(
        interpolatePerPoint(points, closed, u, (p) => p.banking)
      ),
    });
  }
  return samples;
}

function interpolatePerPoint(
  points: RoadControlPoint[],
  closed: boolean,
  u: number,
  getValue: (point: RoadControlPoint) => number
): number {
  const segmentCount = closed ? points.length : points.length - 1;
  const scaled = u * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaled), segmentCount - 1);
  const localT = scaled - segmentIndex;
  const a = getValue(points[segmentIndex]);
  const bIndex = closed ? (segmentIndex + 1) % points.length : segmentIndex + 1;
  const b = getValue(points[bIndex]);
  return THREE.MathUtils.lerp(a, b, localT);
}
