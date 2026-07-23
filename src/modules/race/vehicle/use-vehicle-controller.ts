"use client";

import type { RefObject } from "react";
import * as THREE from "three";
import { useBeforePhysicsStep } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { useKeyboardInput } from "./use-keyboard-input";
import { vehicleVisualState } from "./vehicle-visual-state";

export const VEHICLE_MASS = 900; // kg — kept in sync with Vehicle's RigidBody mass prop

const ENGINE_FORCE = 9000; // N
const BRAKE_FORCE = 7000; // N (also used for reverse)
export const MAX_FORWARD_SPEED = 32; // m/s soft cap -- exported for useVehicleAudio's speed normalization
const MAX_REVERSE_SPEED = 10; // m/s soft cap
const MAX_STEER_RATE = 2.2; // rad/s at full speed
const MIN_STEER_FACTOR = 0.35; // fraction of steer authority available at a standstill
const GRIP = 8; // higher = less sideways sliding

const CAR_FORWARD = new THREE.Vector3(0, 0, 1);
const CAR_RIGHT = new THREE.Vector3(1, 0, 0);

// Arcade-style force model on a single dynamic rigid body rather than
// Rapier's raycast wheel controller — steering is a direct speed-scaled
// angular velocity (not torque) and lateral velocity is damped toward zero
// each frame to simulate tire grip. Simpler to tune than a full wheel/
// suspension sim, closer to the "Mr.doob simplicity" the brief asks for.
//
// Everything is resolved in the car's own forward/lateral scalar speeds and
// applied as a single setLinvel per frame -- mixing applyImpulse with a
// later setLinvel in the same frame would silently discard the impulse
// (setLinvel replaces velocity outright; it doesn't add to it).
//
// Runs on useBeforePhysicsStep, not useFrame -- Rapier's <Physics> steps the
// world on its own fixed internal timestep (default 1/60s) and can run
// several such steps per rendered frame to catch up whenever the render
// rate dips below that (a real gap here, not just a slow-CPU edge case:
// verified at ~14fps the world was substepping ~4x per rendered frame).
// useFrame only fires once per RENDERED frame, so at a lower render rate
// this model's accel*delta was only being applied once while ground
// friction/damping got to act on the body's velocity every one of those
// substeps -- friction had several more chances to act than thrust did, so
// the car barely crept forward. useBeforePhysicsStep fires exactly once per
// actual physics step, keeping thrust and friction/damping in the same
// 1:1 correspondence the model assumes.
export function useVehicleController(rigidBodyRef: RefObject<RapierRigidBody | null>) {
  const input = useKeyboardInput();

  useBeforePhysicsStep((world) => {
    const body = rigidBodyRef.current;
    if (!body) return;
    const delta = world.timestep;

    const r = body.rotation();
    const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const forward = CAR_FORWARD.clone().applyQuaternion(quat);
    const right = CAR_RIGHT.clone().applyQuaternion(quat);

    const lv = body.linvel();
    const velocity = new THREE.Vector3(lv.x, lv.y, lv.z);
    let forwardSpeed = velocity.dot(forward);
    const lateralSpeed = velocity.dot(right);

    const { throttle, steer } = input.current;

    // Steering: direct angular velocity, scaled by current speed so the car
    // doesn't spin in place at a standstill but still turns tightly when slow.
    const speedFactor = THREE.MathUtils.clamp(
      Math.abs(forwardSpeed) / MAX_FORWARD_SPEED,
      0,
      1
    );
    const steerAngVel =
      steer * MAX_STEER_RATE * (MIN_STEER_FACTOR + (1 - MIN_STEER_FACTOR) * speedFactor);
    body.setAngvel({ x: 0, y: steerAngVel, z: 0 }, true);

    // Engine / brake acceleration along the car's forward axis, soft-capped,
    // integrated directly into the scalar forward speed.
    let accel = 0;
    if (throttle > 0 && forwardSpeed < MAX_FORWARD_SPEED) {
      accel = (throttle * ENGINE_FORCE) / VEHICLE_MASS;
    } else if (throttle < 0 && forwardSpeed > -MAX_REVERSE_SPEED) {
      accel = (throttle * BRAKE_FORCE) / VEHICLE_MASS;
    }
    forwardSpeed += accel * delta;

    // Lateral grip: exponentially decay sideways speed toward zero so the
    // car reads as gripping the road instead of ice-skating through turns.
    const gripAlpha = 1 - Math.exp(-GRIP * delta);
    const newLateralSpeed = lateralSpeed * (1 - gripAlpha);

    const corrected = forward
      .clone()
      .multiplyScalar(forwardSpeed)
      .add(right.clone().multiplyScalar(newLateralSpeed));
    corrected.y = lv.y; // preserve vertical velocity (gravity)
    body.setLinvel(corrected, true);

    // Cosmetic-only state for CarModel's lean/wheel animation and the skid
    // sound — read in their own useFrame/update loops, never fed back into
    // physics.
    vehicleVisualState.forwardSpeed = forwardSpeed;
    vehicleVisualState.steerInput = steer;
    vehicleVisualState.throttleInput = throttle;
    vehicleVisualState.lateralSlip = Math.abs(lateralSpeed - newLateralSpeed);
  });
}
