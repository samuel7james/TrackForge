"use client";

import { useEffect, useRef } from "react";
import { RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import { useStartLine } from "@/modules/track-format/hooks";
import { useVehicleController, VEHICLE_MASS } from "./use-vehicle-controller";
import { vehicleHandle } from "./vehicle-ref";
import { CarModel } from "./car-model";

const ORIGIN_SPAWN = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

export function Vehicle() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const startLine = useStartLine();
  const spawn = startLine ?? ORIGIN_SPAWN;

  useVehicleController(rigidBodyRef);

  useEffect(() => {
    vehicleHandle.current = rigidBodyRef.current;
    return () => {
      vehicleHandle.current = null;
    };
  }, []);

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      mass={VEHICLE_MASS}
      position={[spawn.position.x, spawn.position.y + 0.5, spawn.position.z]}
      quaternion={[spawn.rotation.x, spawn.rotation.y, spawn.rotation.z, spawn.rotation.w]}
      linearDamping={0.4}
      angularDamping={4}
      canSleep={false}
    >
      <CuboidCollider args={[0.8, 0.4, 1.9]} />
      <CarModel />
    </RigidBody>
  );
}
