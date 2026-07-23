"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { vehicleVisualState } from "./vehicle-visual-state";

// Real vehicle model from mrdoob's Starter-Kit-Racing (CC0 assets by Kenney --
// see public/models/THIRD_PARTY_NOTICES.md), replacing the earlier procedural
// RoundedBox+cylinder car. Cloned + traversed for named nodes rather than
// rebuilt from extracted geometry -- the reference's own Vehicle.js animates
// this exact asset the same way (wheel.rotation.x for spin, wheel.rotation.y
// for steer, applied directly to each wheel node in place), so mirroring that
// avoids re-deriving wheel positions/pivot axes by trial and error: the
// model's own baked node transforms are already correct for its proportions.
const MODEL_URL = "/models/vehicle-truck-red.glb";

const MAX_ROLL = 0.22; // rad — body bank into turns
const MAX_PITCH = 0.08; // rad — nose dip/lift on accel/brake
const MAX_STEER_VISUAL_ANGLE = 0.5; // rad — front wheel yaw
const LEAN_SMOOTHING = 8;
const STEER_VISUAL_SMOOTHING = 12;
const WHEEL_RADIUS = 0.3; // matches the model's own wheel-node ground clearance

// Soft, radially-faded blob under the car -- a cheap, standard trick for
// "the car reads as planted on the ground" that doesn't depend on shadow-map
// resolution/distance the way castShadow alone does, especially useful at
// the chase-camera distances Play mode uses.
function useContactShadowTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(0,0,0,0.45)");
    gradient.addColorStop(0.7, "rgba(0,0,0,0.2)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

export function CarModel() {
  const { scene } = useGLTF(MODEL_URL);
  const contactShadowTexture = useContactShadowTexture();
  const rootRef = useRef<THREE.Group>(null);

  const bodyRef = useRef<THREE.Object3D | null>(null);
  const wheelFLRef = useRef<THREE.Object3D | null>(null);
  const wheelFRRef = useRef<THREE.Object3D | null>(null);
  const wheelBLRef = useRef<THREE.Object3D | null>(null);
  const wheelBRRef = useRef<THREE.Object3D | null>(null);

  // Cloned once per mount (Play mode remounts Vehicle fresh each session) so
  // multiple cars sharing the cached useGLTF scene never fight over the same
  // live Object3D instances.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Extras layered on top of the real model -- TrackForge additions the
  // reference doesn't have, sized from the model's own bounding box rather
  // than guessed fixed numbers (this truck's proportions aren't the old
  // procedural box's proportions).
  const extras = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    return {
      frontZ: box.max.z,
      rearZ: box.min.z,
      topY: box.max.y,
      halfWidth: size.x / 2,
      groundY: box.min.y,
      length: size.z,
    };
  }, [cloned]);

  useEffect(() => {
    bodyRef.current = null;
    wheelFLRef.current = null;
    wheelFRRef.current = null;
    wheelBLRef.current = null;
    wheelBRRef.current = null;

    cloned.traverse((child) => {
      child.castShadow = true;
      const name = child.name.toLowerCase();
      if (name === "body") bodyRef.current = child;
      if (name.includes("wheel")) {
        const isFront = name.includes("front");
        const isLeft = name.includes("left");
        if (isFront && isLeft) wheelFLRef.current = child;
        else if (isFront) wheelFRRef.current = child;
        else if (isLeft) wheelBLRef.current = child;
        else wheelBRRef.current = child;
      }
    });
  }, [cloned]);

  useFrame((_, delta) => {
    const { forwardSpeed, steerInput, throttleInput } = vehicleVisualState;
    const leanAlpha = 1 - Math.exp(-LEAN_SMOOTHING * delta);
    const steerAlpha = 1 - Math.exp(-STEER_VISUAL_SMOOTHING * delta);

    if (bodyRef.current) {
      const targetRoll = -steerInput * MAX_ROLL;
      const targetPitch = -throttleInput * MAX_PITCH;
      bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, targetRoll, leanAlpha);
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, targetPitch, leanAlpha);
    }

    const spinDelta = (forwardSpeed / WHEEL_RADIUS) * delta;
    if (wheelFLRef.current) wheelFLRef.current.rotation.x += spinDelta;
    if (wheelFRRef.current) wheelFRRef.current.rotation.x += spinDelta;
    if (wheelBLRef.current) wheelBLRef.current.rotation.x += spinDelta;
    if (wheelBRRef.current) wheelBRRef.current.rotation.x += spinDelta;

    const targetSteerAngle = steerInput * MAX_STEER_VISUAL_ANGLE;
    if (wheelFLRef.current) {
      wheelFLRef.current.rotation.y = THREE.MathUtils.lerp(wheelFLRef.current.rotation.y, targetSteerAngle, steerAlpha);
    }
    if (wheelFRRef.current) {
      wheelFRRef.current.rotation.y = THREE.MathUtils.lerp(wheelFRRef.current.rotation.y, targetSteerAngle, steerAlpha);
    }
  });

  return (
    <group ref={rootRef}>
      <primitive object={cloned} />

      {/* Headlights/taillights -- TrackForge additions on top of the real
          model, positioned from its own measured bounding box. */}
      {[-extras.halfWidth * 0.65, extras.halfWidth * 0.65].map((x) => (
        <mesh key={`head-${x}`} position={[x, extras.groundY + 0.28, extras.frontZ - 0.05]}>
          <boxGeometry args={[0.22, 0.12, 0.04]} />
          <meshStandardMaterial color="#fff7e0" emissive="#fff7e0" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {[-extras.halfWidth * 0.65, extras.halfWidth * 0.65].map((x) => (
        <mesh key={`tail-${x}`} position={[x, extras.groundY + 0.28, extras.rearZ + 0.05]}>
          <boxGeometry args={[0.22, 0.12, 0.04]} />
          <meshStandardMaterial color="#ff2d2d" emissive="#ff2d2d" emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* Rear spoiler -- mounted from the model's own top/rear extent. */}
      <group position={[0, extras.topY + 0.05, extras.rearZ + 0.1]}>
        {[-extras.halfWidth * 0.55, extras.halfWidth * 0.55].map((x) => (
          <mesh key={`spoiler-strut-${x}`} position={[x, -0.1, 0]} castShadow>
            <boxGeometry args={[0.05, 0.2, 0.05]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.5} metalness={0.2} />
          </mesh>
        ))}
        <mesh castShadow>
          <boxGeometry args={[extras.halfWidth * 1.4, 0.05, 0.28]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* Contact shadow -- flat, non-shadow-casting, just above the ground
          plane so it never z-fights with the road mesh underneath it. */}
      <mesh position={[0, extras.groundY + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[extras.halfWidth * 2.2, extras.length * 1.2]} />
        <meshBasicMaterial map={contactShadowTexture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
