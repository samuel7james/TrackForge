"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { vehicleVisualState } from "./vehicle-visual-state";
import { updateRearWheelWorldPositions } from "./rear-wheel-tracking";

// Ported from Starter-Kit-Racing's Particles.js (SmokeTrails) -- a fixed pool
// of billboarded points recycled round-robin as they die, with per-particle
// size/opacity injected into PointsMaterial's shader via onBeforeCompile
// (PointsMaterial has no per-vertex size/alpha of its own). One difference:
// the reference loads a smoke.png sprite; this generates an equivalent soft
// radial-gradient puff on a canvas instead, the same technique car-model.tsx
// already uses for its contact-shadow texture, so this doesn't need to pull
// in another binary asset from the reference repo for one texture.
const POOL_SIZE = 240;
const PARTICLES_PER_EMIT = 2;
const EMIT_JITTER = 0.12;
const BASE_SIZE = 0.9;
const MAX_LIFE = 1.1;
const INV_MAX_LIFE = 1 / MAX_LIFE;

// Reuses GameAudio's own skid-remap upper range (driftIntensity's 0.5..2.0
// scale) -- smoke only kicks in once the skid is already loud/heavy, not at
// the first hint of slip that triggers the tire marks.
const DRIFT_THRESHOLD = 0.7;
const MIN_SPEED = 0.5;
// Wheel-center world Y sits one wheel-radius above the road -- see
// drift-marks.tsx's own comment on why this is exactly this vehicle model's
// wheel-node y-offset.
const WHEEL_RADIUS = 0.3;

const _bl = new THREE.Vector3();
const _br = new THREE.Vector3();

function createSmokeTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface Particle {
  life: number;
  velocity: THREE.Vector3;
  initialSize: number;
}

// All mutable pool state lives behind this class's own methods -- the
// react-hooks (React Compiler) lint rule rejects a component directly
// mutating typed arrays/attributes it got back from useMemo (the same
// "modifying a value used previously in a hook" class of error car-model.tsx
// hit with its wheel refs), but is fine with a memoized class instance whose
// own methods mutate its own fields, same pattern DriftTrail (drift-marks.tsx)
// already uses successfully.
class SmokePool {
  points: THREE.Points;
  private positions: Float32Array;
  private opacities: Float32Array;
  private sizes: Float32Array;
  private posAttr: THREE.BufferAttribute;
  private opacityAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private particles: Particle[] = [];
  private emitIndex = 0;

  constructor() {
    const positions = new Float32Array(POOL_SIZE * 3);
    const opacities = new Float32Array(POOL_SIZE);
    const sizes = new Float32Array(POOL_SIZE);

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", posAttr);

    const opacityAttr = new THREE.BufferAttribute(opacities, 1);
    opacityAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aOpacity", opacityAttr);

    const sizeAttr = new THREE.BufferAttribute(sizes, 1);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aSize", sizeAttr);

    const material = new THREE.PointsMaterial({
      map: createSmokeTexture(),
      color: 0x9a9ba5,
      size: 1,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float aSize;\nattribute float aOpacity;\nvarying float vOpacity;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        "void main() {\n\tvOpacity = aOpacity;"
      );
      shader.vertexShader = shader.vertexShader.replace(
        "gl_PointSize = size;",
        "gl_PointSize = size * aSize;"
      );

      shader.fragmentShader = "varying float vOpacity;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        "vec4 diffuseColor = vec4( diffuse, opacity * vOpacity );"
      );
    };

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;

    this.positions = positions;
    this.opacities = opacities;
    this.sizes = sizes;
    this.posAttr = posAttr;
    this.opacityAttr = opacityAttr;
    this.sizeAttr = sizeAttr;

    for (let i = 0; i < POOL_SIZE; i++) {
      this.particles.push({ life: 0, velocity: new THREE.Vector3(), initialSize: 0 });
    }
  }

  emit(x: number, y: number, z: number) {
    const i = this.emitIndex;
    this.emitIndex = (i + 1) % POOL_SIZE;

    const p = this.particles[i];
    const posIdx = i * 3;
    this.positions[posIdx] = x + (Math.random() - 0.5) * EMIT_JITTER;
    this.positions[posIdx + 1] = y + Math.random() * EMIT_JITTER;
    this.positions[posIdx + 2] = z + (Math.random() - 0.5) * EMIT_JITTER;

    p.initialSize = BASE_SIZE * (0.5 + Math.random() * 0.5);
    p.velocity.set(
      (Math.random() - 0.5) * 0.2,
      0.4 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.2
    );
    p.life = MAX_LIFE;
  }

  step(delta: number, didEmit: boolean) {
    const damping = 1 - Math.min(delta, 1);
    let aliveCount = 0;

    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;

      p.life -= delta;

      if (p.life <= 0) {
        this.opacities[i] = 0;
        aliveCount++;
        continue;
      }

      const t = 1 - p.life * INV_MAX_LIFE;
      p.velocity.multiplyScalar(damping);

      const posIdx = i * 3;
      this.positions[posIdx] += p.velocity.x * delta;
      this.positions[posIdx + 1] += p.velocity.y * delta;
      this.positions[posIdx + 2] += p.velocity.z * delta;

      this.opacities[i] = (1 - t) * 0.3;
      this.sizes[i] = p.initialSize * (0.5 + t * 2.5);
      aliveCount++;
    }

    if (didEmit || aliveCount > 0) {
      this.posAttr.needsUpdate = true;
      this.opacityAttr.needsUpdate = true;
      this.sizeAttr.needsUpdate = true;
    }
  }
}

export function TireSmoke() {
  const poolRef = useRef<THREE.Points>(null);
  const pool = useMemo(() => new SmokePool(), []);

  useFrame((_, delta) => {
    const hasVehicle = updateRearWheelWorldPositions(_bl, _br);

    const driftIntensity = vehicleVisualState.driftIntensity;
    const shouldEmit =
      hasVehicle && driftIntensity > DRIFT_THRESHOLD && Math.abs(vehicleVisualState.forwardSpeed) > MIN_SPEED;

    if (shouldEmit) {
      for (let i = 0; i < PARTICLES_PER_EMIT; i++) {
        pool.emit(_bl.x, _bl.y - WHEEL_RADIUS, _bl.z);
        pool.emit(_br.x, _br.y - WHEEL_RADIUS, _br.z);
      }
    }

    pool.step(delta, shouldEmit);
  });

  return <primitive ref={poolRef} object={pool.points} />;
}
