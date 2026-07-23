"use client";

import { useRef } from "react";
import * as THREE from "three";
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { vehicleHandle } from "@/modules/race/vehicle/vehicle-ref";
import { vehicleVisualState } from "@/modules/race/vehicle/vehicle-visual-state";
import { cameraShakeState } from "@/modules/race/vehicle/camera-shake-state";
import { MAX_FORWARD_SPEED } from "@/modules/race/vehicle/use-vehicle-controller";

// Behind (-Z, since the car's forward is local +Z) and above the car.
const CHASE_OFFSET = new THREE.Vector3(0, 3.2, -7.5);
const LOOK_OFFSET = new THREE.Vector3(0, 0.6, 0);
const POSITION_SMOOTHING = 6; // higher = snappier follow
const LOOK_SMOOTHING = 10;

// Speed-based FOV kick -- a cheap but effective "feels fast" cue arcade
// racers lean on heavily (Starter-Kit-Racing doesn't do this itself, its
// Camera.js uses a fixed 40deg FOV, but the wider chase-cam framing here
// has room for it). Widens toward FOV_MAX as forward speed approaches
// MAX_FORWARD_SPEED, smoothed so it doesn't visibly step on every throttle
// tap.
const FOV_BASE = 65;
const FOV_MAX = 74;
const FOV_SMOOTHING = 4;

// Trauma-model screen shake (see camera-shake-state.ts) -- offset scales
// with trauma^2 so it ramps up sharply for hard hits but stays subtle for
// glancing ones, and decays back to 0 over roughly half a second.
const SHAKE_DECAY = 2.2; // trauma/sec
const SHAKE_POSITION_MAX = 0.35;
const SHAKE_ROTATION_MAX = 0.05; // rad

export function PlayModeCameraRig() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const currentLookAt = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const body = vehicleHandle.current;
    const camera = cameraRef.current;
    if (!body || !camera) return;

    const t = body.translation();
    const r = body.rotation();
    const carPosition = new THREE.Vector3(t.x, t.y, t.z);
    const carQuat = new THREE.Quaternion(r.x, r.y, r.z, r.w);

    const desiredPosition = carPosition
      .clone()
      .add(CHASE_OFFSET.clone().applyQuaternion(carQuat));
    const desiredLookAt = carPosition.clone().add(LOOK_OFFSET);

    if (!initialized.current) {
      camera.position.copy(desiredPosition);
      currentLookAt.current.copy(desiredLookAt);
      initialized.current = true;
    } else {
      camera.position.lerp(desiredPosition, 1 - Math.exp(-POSITION_SMOOTHING * delta));
      currentLookAt.current.lerp(desiredLookAt, 1 - Math.exp(-LOOK_SMOOTHING * delta));
    }

    camera.lookAt(currentLookAt.current);

    const speed01 = THREE.MathUtils.clamp(
      Math.abs(vehicleVisualState.forwardSpeed) / MAX_FORWARD_SPEED,
      0,
      1
    );
    const targetFov = THREE.MathUtils.lerp(FOV_BASE, FOV_MAX, speed01);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-FOV_SMOOTHING * delta));
    camera.updateProjectionMatrix();

    const trauma = cameraShakeState.trauma;
    if (trauma > 0) {
      const shakeAmount = trauma * trauma;
      camera.position.x += (Math.random() * 2 - 1) * SHAKE_POSITION_MAX * shakeAmount;
      camera.position.y += (Math.random() * 2 - 1) * SHAKE_POSITION_MAX * shakeAmount;
      camera.rotation.z += (Math.random() * 2 - 1) * SHAKE_ROTATION_MAX * shakeAmount;
      cameraShakeState.trauma = Math.max(0, trauma - SHAKE_DECAY * delta);
    }
  });

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={65} position={[0, 3.2, -7.5]} />
  );
}
