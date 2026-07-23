"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { vehicleVisualState } from "./vehicle-visual-state";
import { updateRearWheelWorldPositions } from "./rear-wheel-tracking";

// Ported from Starter-Kit-Racing's DriftMarks.js -- same ring-buffer ribbon-
// strip technique (a growing quad per wheel-movement segment, alpha-faded by
// drift intensity, all in one dynamic BufferGeometry so the whole trail is a
// single draw call). Deliberately dropped: the reference's localStorage
// serialize/load round trip that makes marks survive a page reload -- nothing
// else in TrackForge persists local-only state like that, and Play mode
// already remounts Vehicle (and now DriftMarks) fresh every session, so a
// trail that resets each run is the more consistent behavior here.
const MAX_SEGMENTS = 2048;
const VERTS_PER_SEGMENT = 6;
const FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * 3;
const COLOR_FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * 4;

const WIDTH = 0.09;
// Wheel-center world Y sits one wheel-radius (matches car-model.tsx's own
// WHEEL_RADIUS) above the road, since the model's local origin -- which the
// RigidBody's own origin coincides with, CarModel adding no extra offset --
// is exactly ground level for this vehicle (its wheel nodes are baked at
// y=0.3, the same as their radius, so the wheel bottom sits at y=0).
const WHEEL_RADIUS = 0.3;
const Y_OFFSET = 0.03; // lift above the road so marks don't z-fight the surface
const MIN_SEGMENT_LENGTH = 0.02;

// Reuses GameAudio's own skid-onset threshold (driftIntensity > 0.5) so tire
// marks appear exactly when the skid sound starts, not on some independently-
// tuned cutoff.
const DRIFT_THRESHOLD = 0.5;
const MIN_SPEED = 0.5; // m/s -- gates marks while stationary and spinning in place

const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _pL = new THREE.Vector3();
const _pR = new THREE.Vector3();
const _cL = new THREE.Vector3();
const _cR = new THREE.Vector3();
const _bl = new THREE.Vector3();
const _br = new THREE.Vector3();

class DriftTrail {
  mesh: THREE.Mesh;
  private positions: Float32Array;
  private colors: Float32Array;
  private geometry: THREE.BufferGeometry;
  private segmentIndex = 0;
  private drawCount = 0;
  private prev = new THREE.Vector3();
  private active = false;

  constructor(material: THREE.Material) {
    const positions = new Float32Array(MAX_SEGMENTS * FLOATS_PER_SEGMENT);
    const colors = new Float32Array(MAX_SEGMENTS * COLOR_FLOATS_PER_SEGMENT);
    for (let i = 0; i < MAX_SEGMENTS * VERTS_PER_SEGMENT; i++) {
      const o = i * 4;
      colors[o] = 1;
      colors[o + 1] = 1;
      colors[o + 2] = 1;
    }

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", posAttr);

    const colorAttr = new THREE.BufferAttribute(colors, 4);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", colorAttr);

    geometry.setDrawRange(0, 0);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;

    this.positions = positions;
    this.colors = colors;
    this.geometry = geometry;
  }

  track(wheelWorld: THREE.Vector3, groundY: number, alpha: number, emit: boolean) {
    const current = wheelWorld.clone();
    current.y = groundY;

    if (emit && this.active) {
      this.writeSegment(this.prev, current, alpha);
    }

    this.prev.copy(current);
    this.active = emit;
  }

  private writeSegment(prev: THREE.Vector3, curr: THREE.Vector3, alpha: number) {
    _dir.subVectors(curr, prev);
    _dir.y = 0;
    const len = _dir.length();
    if (len < MIN_SEGMENT_LENGTH) return;
    _dir.divideScalar(len);

    _side.set(_dir.z, 0, -_dir.x).multiplyScalar(WIDTH);

    _pL.copy(prev).add(_side);
    _pR.copy(prev).sub(_side);
    _cL.copy(curr).add(_side);
    _cR.copy(curr).sub(_side);

    const offset = this.segmentIndex * FLOATS_PER_SEGMENT;
    const p = this.positions;

    p[offset + 0] = _pL.x; p[offset + 1] = _pL.y; p[offset + 2] = _pL.z;
    p[offset + 3] = _pR.x; p[offset + 4] = _pR.y; p[offset + 5] = _pR.z;
    p[offset + 6] = _cL.x; p[offset + 7] = _cL.y; p[offset + 8] = _cL.z;
    p[offset + 9] = _pR.x; p[offset + 10] = _pR.y; p[offset + 11] = _pR.z;
    p[offset + 12] = _cR.x; p[offset + 13] = _cR.y; p[offset + 14] = _cR.z;
    p[offset + 15] = _cL.x; p[offset + 16] = _cL.y; p[offset + 17] = _cL.z;

    const colorOffset = this.segmentIndex * COLOR_FLOATS_PER_SEGMENT;
    const c = this.colors;
    for (let i = 0; i < VERTS_PER_SEGMENT; i++) {
      c[colorOffset + i * 4 + 3] = alpha;
    }

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.addUpdateRange(offset, FLOATS_PER_SEGMENT);
    posAttr.needsUpdate = true;

    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    colAttr.addUpdateRange(colorOffset, COLOR_FLOATS_PER_SEGMENT);
    colAttr.needsUpdate = true;

    this.segmentIndex = (this.segmentIndex + 1) % MAX_SEGMENTS;

    if (this.drawCount < MAX_SEGMENTS * VERTS_PER_SEGMENT) {
      this.drawCount += VERTS_PER_SEGMENT;
      this.geometry.setDrawRange(0, this.drawCount);
    }
  }
}

export function DriftMarks() {
  const groupRef = useRef<THREE.Group>(null);

  const { group, trailBL, trailBR } = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.55,
      vertexColors: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

    const trailBL = new DriftTrail(material);
    const trailBR = new DriftTrail(material);

    const group = new THREE.Group();
    group.add(trailBL.mesh, trailBR.mesh);

    return { group, trailBL, trailBR };
  }, []);

  useFrame(() => {
    const hasVehicle = updateRearWheelWorldPositions(_bl, _br);
    if (!hasVehicle) return;

    const driftIntensity = vehicleVisualState.driftIntensity;
    const emit = driftIntensity > DRIFT_THRESHOLD && Math.abs(vehicleVisualState.forwardSpeed) > MIN_SPEED;
    const alpha = THREE.MathUtils.clamp((driftIntensity - DRIFT_THRESHOLD) / DRIFT_THRESHOLD, 0, 1);

    const groundY = _bl.y - WHEEL_RADIUS + Y_OFFSET;
    trailBL.track(_bl, groundY, alpha, emit);
    trailBR.track(_br, groundY, alpha, emit);
  });

  return <primitive ref={groupRef} object={group} />;
}
