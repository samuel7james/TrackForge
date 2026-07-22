"use client";

import { useRef } from "react";
import * as THREE from "three";
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { vehicleHandle } from "@/modules/race/vehicle/vehicle-ref";

// Behind (-Z, since the car's forward is local +Z) and above the car.
const CHASE_OFFSET = new THREE.Vector3(0, 3.2, -7.5);
const LOOK_OFFSET = new THREE.Vector3(0, 0.6, 0);
const POSITION_SMOOTHING = 6; // higher = snappier follow
const LOOK_SMOOTHING = 10;

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
  });

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={65} position={[0, 3.2, -7.5]} />
  );
}
