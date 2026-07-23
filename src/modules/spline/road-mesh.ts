import * as THREE from "three";
import type { RoadSample } from "./catmull-rom";

const UP = new THREE.Vector3(0, 1, 0);
const ROAD_SURFACE_HEIGHT = 0.02;
const CURB_SURFACE_HEIGHT = 0.03;
const CURB_WIDTH = 0.6;
const CURB_BAND_LENGTH = 2; // meters per alternating red/white segment
// How much of the locally-estimated turn radius the half-width is allowed to
// use -- keeps the ribbon's two edges from crossing through the inside of a
// sharp corner (a naive constant-width offset self-intersects once the turn
// radius drops below the half-width; this narrows the road smoothly instead).
const CORNER_SAFETY_FACTOR = 0.9;

// Cross-section "right" vector, rolled around the tangent by the bank angle
// -- rotating it this way (rather than offsetting height separately) raises
// the outer edge and lowers the inner one exactly like a real banked corner.
function rightVector(tangent: THREE.Vector3, bank: number): THREE.Vector3 {
  const right = new THREE.Vector3().crossVectors(tangent, UP).normalize();
  if (bank === 0) return right;
  return right.applyAxisAngle(tangent, bank);
}

// Estimates the local turn radius at sample i from how much the tangent
// direction changes over the distance to its neighbors (radius = arc length
// / angle swept; a straight stretch has ~0 angle change, so radius -> Infinity
// and the clamp below never kicks in there). Uses a several-sample-wide
// window rather than the immediate neighbors -- a single-sample stencil
// under-estimates sharpness on a smooth spline (the curvature is spread
// continuously rather than concentrated at one sample), which still let
// hairpin turns self-intersect in practice.
const CURVATURE_WINDOW = 4;

export function estimateTurnRadius(samples: RoadSample[], i: number): number {
  const a = samples[Math.max(i - CURVATURE_WINDOW, 0)];
  const b = samples[Math.min(i + CURVATURE_WINDOW, samples.length - 1)];
  const angle = a.tangent.angleTo(b.tangent);
  if (angle < 1e-4) return Infinity;
  const dist = a.position.distanceTo(b.position);
  return dist / angle;
}

// Exported so track validation (Phase 16) can flag a corner as impassable
// using the exact same narrowing the visual/collider geometry already
// applies, rather than a second, potentially-inconsistent estimate of "is
// this corner too tight."
export function safeHalfWidth(samples: RoadSample[], i: number, requestedHalfWidth: number): number {
  const radius = estimateTurnRadius(samples, i);
  return Math.min(requestedHalfWidth, radius * CORNER_SAFETY_FACTOR);
}

// Flat ribbon extruded along the centerline, offset by each sample's width.
export function buildRoadGeometry(samples: RoadSample[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (samples.length < 2) return geometry;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  samples.forEach((sample, i) => {
    const right = rightVector(sample.tangent, sample.bank);
    const halfWidth = safeHalfWidth(samples, i, sample.width / 2);
    const left = sample.position.clone().addScaledVector(right, -halfWidth);
    const rightEdge = sample.position.clone().addScaledVector(right, halfWidth);

    positions.push(left.x, left.y + ROAD_SURFACE_HEIGHT, left.z);
    positions.push(rightEdge.x, rightEdge.y + ROAD_SURFACE_HEIGHT, rightEdge.z);

    const v = (i / (samples.length - 1)) * samples.length * 0.15;
    uvs.push(0, v);
    uvs.push(1, v);
  });

  for (let i = 0; i < samples.length - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Two outer bands (left + right) running alongside the road edges, colored
// in alternating red/white segments — the classic curb look.
export function buildCurbGeometry(samples: RoadSample[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (samples.length < 2) return geometry;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const white = new THREE.Color("#e8e8e8");
  const red = new THREE.Color("#b3211f");
  let distance = 0;

  samples.forEach((sample, i) => {
    if (i > 0) distance += sample.position.distanceTo(samples[i - 1].position);
    const bandColor =
      Math.floor(distance / CURB_BAND_LENGTH) % 2 === 0 ? red : white;

    const right = rightVector(sample.tangent, sample.bank);
    const halfWidth = safeHalfWidth(samples, i, sample.width / 2);

    const leftInner = sample.position.clone().addScaledVector(right, -halfWidth);
    const leftOuter = sample.position
      .clone()
      .addScaledVector(right, -(halfWidth + CURB_WIDTH));
    const rightInner = sample.position.clone().addScaledVector(right, halfWidth);
    const rightOuter = sample.position
      .clone()
      .addScaledVector(right, halfWidth + CURB_WIDTH);

    for (const p of [leftInner, leftOuter, rightInner, rightOuter]) {
      positions.push(p.x, p.y + CURB_SURFACE_HEIGHT, p.z);
      colors.push(bandColor.r, bandColor.g, bandColor.b);
    }
  });

  const STRIDE = 4; // leftInner, leftOuter, rightInner, rightOuter
  for (let i = 0; i < samples.length - 1; i++) {
    const base = i * STRIDE;
    const next = (i + 1) * STRIDE;
    // left band
    indices.push(base + 0, next + 0, base + 1, base + 1, next + 0, next + 1);
    // right band
    indices.push(base + 2, base + 3, next + 2, base + 3, next + 3, next + 2);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
