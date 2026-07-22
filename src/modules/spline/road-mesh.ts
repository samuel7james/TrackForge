import * as THREE from "three";
import type { RoadSample } from "./catmull-rom";

const UP = new THREE.Vector3(0, 1, 0);
const ROAD_SURFACE_HEIGHT = 0.02;
const CURB_SURFACE_HEIGHT = 0.03;
const CURB_WIDTH = 0.6;
const CURB_BAND_LENGTH = 2; // meters per alternating red/white segment

function rightVector(tangent: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().crossVectors(tangent, UP).normalize();
}

// Flat ribbon extruded along the centerline, offset by each sample's width.
export function buildRoadGeometry(samples: RoadSample[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (samples.length < 2) return geometry;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  samples.forEach((sample, i) => {
    const right = rightVector(sample.tangent);
    const halfWidth = sample.width / 2;
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

    const right = rightVector(sample.tangent);
    const halfWidth = sample.width / 2;

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
