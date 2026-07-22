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

  // Position/rotation are set imperatively, once, on mount -- NOT passed as
  // ongoing JSX props. React Three Fiber re-applies array-valued props like
  // `position` on every render (it can't cheaply diff array contents), which
  // was fighting the physics simulation: it kept resetting the RigidBody
  // back to the spawn point, so setLinvel's velocity was silently discarded
  // every time Vehicle re-rendered. Confirmed the hard way with per-frame
  // velocity logging: forward speed built up for a couple of physics steps,
  // then snapped back to ~0 in a tight repeating cycle -- the car was
  // "driving" in place. A mount-only effect avoids the fight entirely; this
  // is also semantically correct since Vehicle only ever mounts fresh when
  // Play starts (ModeController), so there's exactly one spawn per session.
  useEffect(() => {
    const body = rigidBodyRef.current;
    if (!body) return;
    body.setTranslation(
      { x: spawn.position.x, y: spawn.position.y + 0.5, z: spawn.position.z },
      true
    );
    body.setRotation(
      { x: spawn.rotation.x, y: spawn.rotation.y, z: spawn.rotation.z, w: spawn.rotation.w },
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      mass={VEHICLE_MASS}
      linearDamping={0.4}
      angularDamping={4}
      canSleep={false}
    >
      <CuboidCollider args={[0.8, 0.4, 1.9]} />
      <CarModel />
    </RigidBody>
  );
}
