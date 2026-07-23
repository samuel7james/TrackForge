"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { RigidBody, RoundCuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import { useStartLine } from "@/modules/track-format/hooks";
import { useVehicleController, VEHICLE_MASS } from "./use-vehicle-controller";
import { useVehicleAudio } from "./use-vehicle-audio";
import { vehicleHandle } from "./vehicle-ref";
import { CarModel } from "./car-model";

const CAR_FORWARD = new THREE.Vector3(0, 0, 1);

const ORIGIN_SPAWN = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

export function Vehicle() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const audioAnchorRef = useRef<THREE.Group>(null);
  const startLine = useStartLine();
  const spawn = startLine ?? ORIGIN_SPAWN;

  useVehicleController(rigidBodyRef);
  const { playImpact } = useVehicleAudio(audioAnchorRef);

  useEffect(() => {
    vehicleHandle.current = rigidBodyRef.current;
    return () => {
      vehicleHandle.current = null;
    };
  }, []);

  // Impact velocity is the vehicle's own forward-speed component at the
  // moment of contact, not the collision manifold's normal/impulse -- same
  // method Starter-Kit-Racing's contact listener uses. Simpler than reading
  // Rapier's contact data, and it's really "how hard was I driving into
  // whatever I just hit" that should drive the sound, not the physics
  // engine's own resolution of it.
  const handleCollisionEnter = useCallback(() => {
    const body = rigidBodyRef.current;
    if (!body) return;
    const r = body.rotation();
    const forward = CAR_FORWARD.clone().applyQuaternion(
      new THREE.Quaternion(r.x, r.y, r.z, r.w)
    );
    const lv = body.linvel();
    const impactVelocity = Math.abs(forward.dot(new THREE.Vector3(lv.x, lv.y, lv.z)));
    playImpact(impactVelocity);
  }, [playImpact]);

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
      onCollisionEnter={handleCollisionEnter}
    >
      {/* Rounded rather than a sharp CuboidCollider -- a corner-free footprint
          deflects smoothly off props/walls instead of catching an edge and
          snagging or flipping the car, the same "forgiving collision" idea
          Starter-Kit-Racing gets from using a bare sphere as its physics body.
          Base half-extents are shrunk by the border radius so the effective
          footprint stays close to the original 0.8 x 0.4 x 1.9 box. */}
      <RoundCuboidCollider args={[0.65, 0.3, 1.75, 0.15]} />
      <group ref={audioAnchorRef} />
      <CarModel />
    </RigidBody>
  );
}
