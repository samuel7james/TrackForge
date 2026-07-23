"use client";

import { useMemo, useRef } from "react";
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
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
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

function Wheel({
  position,
  spinRef,
}: {
  position: [number, number, number];
  spinRef: React.RefObject<THREE.Group | null>;
}) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]} ref={spinRef}>
      <mesh castShadow>
        <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 24]} />
        <meshStandardMaterial color="#161616" roughness={0.75} />
      </mesh>
      {/* Rim -- a lighter inset disc on each flat face of the tire cylinder,
          reads as an actual wheel rather than a flat tire from any camera
          angle. No extra rotation needed: a cylinder's own flat face is
          already perpendicular to its local Y axis, same as the tire it
          sits flush against -- an earlier version added a redundant X
          rotation here, which (composed with the wheel group's own Z
          rotation) tipped the discs out to the side as visible white
          slivers poking past the tire instead of sitting flush on its face. */}
      <mesh position={[0, 0.145, 0]}>
        <cylinderGeometry args={[WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.01, 12]} />
        <meshStandardMaterial color="#c7cad0" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, -0.145, 0]}>
        <cylinderGeometry args={[WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.01, 12]} />
        <meshStandardMaterial color="#c7cad0" roughness={0.35} metalness={0.7} />
      </mesh>
    </group>
  );
}

export function CarModel() {
  const contactShadowTexture = useContactShadowTexture();
  const leanGroupRef = useRef<THREE.Group>(null);
  const frontLeftSteerRef = useRef<THREE.Group>(null);
  const frontRightSteerRef = useRef<THREE.Group>(null);
  const rearLeftSpinRef = useRef<THREE.Group>(null);
  const rearRightSpinRef = useRef<THREE.Group>(null);
  const frontLeftSpinRef = useRef<THREE.Group>(null);
  const frontRightSpinRef = useRef<THREE.Group>(null);

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

        {/* Rear spoiler -- two uprights + a wing, the one silhouette detail
            that reads as "sporty" from every camera angle this game uses. */}
        <group position={[0, 0.55, -1.55]}>
          {[-0.55, 0.55].map((x) => (
            <mesh key={`spoiler-strut-${x}`} position={[x, -0.12, 0]} castShadow>
              <boxGeometry args={[0.06, 0.24, 0.06]} />
              <meshStandardMaterial color="#1c1c1c" roughness={0.5} metalness={0.2} />
            </mesh>
          ))}
          <mesh castShadow>
            <boxGeometry args={[1.3, 0.06, 0.34]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      </group>

      <Wheel position={REAR_LEFT} spinRef={rearLeftSpinRef} />
      <Wheel position={REAR_RIGHT} spinRef={rearRightSpinRef} />
      <group ref={frontLeftSteerRef} position={FRONT_LEFT}>
        <Wheel position={[0, 0, 0]} spinRef={frontLeftSpinRef} />
      </group>
      <group ref={frontRightSteerRef} position={FRONT_RIGHT}>
        <Wheel position={[0, 0, 0]} spinRef={frontRightSpinRef} />
      </group>

      {/* Contact shadow -- flat, non-shadow-casting, just above the ground
          plane so it never z-fights with the road mesh underneath it. */}
      <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 4.4]} />
        <meshBasicMaterial
          map={contactShadowTexture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
