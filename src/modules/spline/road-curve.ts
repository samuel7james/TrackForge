import * as THREE from "three";
import type { RoadControlPoint } from "@/modules/track-format/schema";

function toVector3(p: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

// Uniform Catmull-Rom tangent expressed as a Hermite tangent (the standard
// CR-to-Hermite identity: interior tangent = half the chord to neighbors;
// one-sided at open endpoints). Exported so the inspector can snapshot the
// current auto tangent as a starting point when a point switches to manual
// mode -- without this, flipping the toggle would jump the curve to a zero
// tangent instead of continuing smoothly from wherever it already was.
export function computeAutoTangent(
  positions: THREE.Vector3[],
  closed: boolean,
  index: number
): THREE.Vector3 {
  const n = positions.length;
  if (n < 2) return new THREE.Vector3();

  if (closed) {
    const prev = positions[(index - 1 + n) % n];
    const next = positions[(index + 1) % n];
    return next.clone().sub(prev).multiplyScalar(0.5);
  }
  if (index === 0) return positions[1].clone().sub(positions[0]);
  if (index === n - 1) return positions[n - 1].clone().sub(positions[n - 2]);
  return positions[index + 1].clone().sub(positions[index - 1]).multiplyScalar(0.5);
}

// Cubic Hermite spline through the control points -- a generalization of the
// Catmull-Rom curve this replaced (THREE.CatmullRomCurve3): a spline made
// entirely of "auto" points uses the exact same tangent formula and renders
// identically to before, but a "manual" point substitutes its authored
// tangentIn/tangentOut, letting one corner be reshaped without affecting how
// neighboring auto corners behave (unlike a global interpolation-mode swap).
export class RoadCurve extends THREE.Curve<THREE.Vector3> {
  private readonly positions: THREE.Vector3[];
  private readonly outTangents: THREE.Vector3[];
  private readonly inTangents: THREE.Vector3[];
  private readonly closed: boolean;

  constructor(points: RoadControlPoint[], closed: boolean) {
    super();
    this.closed = closed;
    this.positions = points.map((p) => toVector3(p.position));
    this.outTangents = points.map((p, i) =>
      p.tangentMode === "manual"
        ? toVector3(p.tangentOut)
        : computeAutoTangent(this.positions, closed, i)
    );
    this.inTangents = points.map((p, i) =>
      p.tangentMode === "manual"
        ? toVector3(p.tangentIn)
        : computeAutoTangent(this.positions, closed, i)
    );
  }

  getPoint(t: number, target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const n = this.positions.length;
    const segmentCount = this.closed ? n : n - 1;
    const scaled = t * segmentCount;
    let i = Math.floor(scaled);
    if (i >= segmentCount) i = segmentCount - 1;
    if (i < 0) i = 0;
    const localT = scaled - i;
    const j = this.closed ? (i + 1) % n : i + 1;

    const p0 = this.positions[i];
    const p1 = this.positions[j];
    const t0 = this.outTangents[i];
    const t1 = this.inTangents[j];

    const t2 = localT * localT;
    const t3 = t2 * localT;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + localT;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return target.set(
      h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
      h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
      h00 * p0.z + h10 * t0.z + h01 * p1.z + h11 * t1.z
    );
  }
}
