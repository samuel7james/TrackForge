"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { vehicleVisualState } from "./vehicle-visual-state";

// Forward is local +Z, matching the convention generateStartLine/
// generateCheckpoints already use, so spawn rotation needs no adjustment.
const WHEEL_RADIUS = 0.32;
const REAR_LEFT: [number, number, number] = [-0.75, -0.2, -1.15];
const REAR_RIGHT: [number, number, number] = [0.75, -0.2, -1.15];
const FRONT_LEFT: [number, number, number] = [-0.75, -0.2, 1.15];
const FRONT_RIGHT: [number, number, number] = [0.75, -0.2, 1.15];

const MAX_ROLL = 0.22; // rad — body bank into turns
const MAX_PITCH = 0.08; // rad — nose dip/lift on accel/brake
const MAX_STEER_VISUAL_ANGLE = 0.5; // rad — front wheel yaw
const LEAN_SMOOTHING = 8;
const STEER_VISUAL_SMOOTHING = 12;

function Wheel({
  position,
  spinRef,
}: {
  position: [number, number, number];
  spinRef: React.RefObject<THREE.Mesh | null>;
}) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow ref={spinRef}>
      <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 20]} />
      <meshStandardMaterial color="#161616" roughness={0.75} />
    </mesh>
  );
}

export function CarModel() {
  const leanGroupRef = useRef<THREE.Group>(null);
  const frontLeftSteerRef = useRef<THREE.Group>(null);
  const frontRightSteerRef = useRef<THREE.Group>(null);
  const rearLeftSpinRef = useRef<THREE.Mesh>(null);
  const rearRightSpinRef = useRef<THREE.Mesh>(null);
  const frontLeftSpinRef = useRef<THREE.Mesh>(null);
  const frontRightSpinRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const { forwardSpeed, steerInput, throttleInput } = vehicleVisualState;
    const leanAlpha = 1 - Math.exp(-LEAN_SMOOTHING * delta);
    const steerAlpha = 1 - Math.exp(-STEER_VISUAL_SMOOTHING * delta);

    if (leanGroupRef.current) {
      const targetRoll = -steerInput * MAX_ROLL;
      const targetPitch = -throttleInput * MAX_PITCH;
      leanGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        leanGroupRef.current.rotation.z,
        targetRoll,
        leanAlpha
      );
      leanGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        leanGroupRef.current.rotation.x,
        targetPitch,
        leanAlpha
      );
    }

    const spinDelta = (forwardSpeed / WHEEL_RADIUS) * delta;
    for (const ref of [rearLeftSpinRef, rearRightSpinRef, frontLeftSpinRef, frontRightSpinRef]) {
      ref.current?.rotateY(spinDelta);
    }

    const targetSteerAngle = steerInput * MAX_STEER_VISUAL_ANGLE;
    for (const ref of [frontLeftSteerRef, frontRightSteerRef]) {
      if (ref.current) {
        ref.current.rotation.y = THREE.MathUtils.lerp(
          ref.current.rotation.y,
          targetSteerAngle,
          steerAlpha
        );
      }
    }
  });

  return (
    <group>
      <group ref={leanGroupRef}>
        <RoundedBox args={[1.6, 0.5, 3.6]} radius={0.12} smoothness={4} castShadow>
          <meshStandardMaterial color="#e0393e" roughness={0.35} metalness={0.3} />
        </RoundedBox>
        <RoundedBox
          args={[1.2, 0.4, 1.6]}
          radius={0.1}
          smoothness={4}
          position={[0, 0.35, -0.3]}
          castShadow
        >
          <meshStandardMaterial
            color="#9fd8ff"
            roughness={0.1}
            metalness={0.1}
            transparent
            opacity={0.35}
          />
        </RoundedBox>

        {/* Headlights */}
        {[-0.55, 0.55].map((x) => (
          <mesh key={`head-${x}`} position={[x, 0.05, 1.78]}>
            <boxGeometry args={[0.28, 0.14, 0.05]} />
            <meshStandardMaterial
              color="#fff7e0"
              emissive="#fff7e0"
              emissiveIntensity={1.4}
            />
          </mesh>
        ))}
        {/* Taillights */}
        {[-0.55, 0.55].map((x) => (
          <mesh key={`tail-${x}`} position={[x, 0.05, -1.78]}>
            <boxGeometry args={[0.28, 0.14, 0.05]} />
            <meshStandardMaterial
              color="#ff2d2d"
              emissive="#ff2d2d"
              emissiveIntensity={1.2}
            />
          </mesh>
        ))}
      </group>

      <Wheel position={REAR_LEFT} spinRef={rearLeftSpinRef} />
      <Wheel position={REAR_RIGHT} spinRef={rearRightSpinRef} />
      <group ref={frontLeftSteerRef} position={FRONT_LEFT}>
        <Wheel position={[0, 0, 0]} spinRef={frontLeftSpinRef} />
      </group>
      <group ref={frontRightSteerRef} position={FRONT_RIGHT}>
        <Wheel position={[0, 0, 0]} spinRef={frontRightSpinRef} />
      </group>
    </group>
  );
}
