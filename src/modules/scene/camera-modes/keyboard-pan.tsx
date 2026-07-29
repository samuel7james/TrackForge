"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// WASD/arrow panning for the orbit rig, so building a track that runs off
// the edge of the view doesn't mean right-drag-panning the whole way there.
// It slides the view across the ground rather than flying the camera
// (that's what FreeFlyCameraRig is for) -- the angle and zoom you set stay
// exactly as they were, only what's centred changes.
//
// Renders nothing; it exists to hold the key listeners and per-frame work,
// and must live inside the Canvas for useFrame.

const PAN_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

/** Fraction of the camera's own distance-to-target covered per second.
 * Tying the rate to distance rather than fixing it in world units is what
 * makes one key feel right at both ends of the zoom range: pulled back
 * over a whole track you cross it in about a second, zoomed into a corner
 * you nudge by a tile. */
const PAN_SPEED = 0.8;
const BOOST_MULTIPLIER = 2.5;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// The editor header has a live text input for the track name, and the
// publish dialog has more -- without this, naming a track "Wasteland"
// would drive the camera around while typing it.
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}

export function KeyboardPan() {
  // Set by OrbitControls' `makeDefault` -- null for the first frame or two
  // before it registers, hence the guard in useFrame.
  const controls = useThree((state) => state.controls) as unknown as {
    target: THREE.Vector3;
  } | null;
  const camera = useThree((state) => state.camera);

  const keys = useRef(new Set<string>());
  const boost = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      boost.current = event.shiftKey;
      const key = event.key.toLowerCase();
      if (!PAN_KEYS.has(key) || isTypingTarget(event.target)) return;
      keys.current.add(key);
      // Arrow keys would otherwise scroll the page behind the canvas.
      event.preventDefault();
    }
    function onKeyUp(event: KeyboardEvent) {
      boost.current = event.shiftKey;
      keys.current.delete(event.key.toLowerCase());
    }
    // A key still held when the window loses focus never delivers its
    // keyup, which would leave the view sliding forever on return.
    function clearHeldKeys() {
      keys.current.clear();
      boost.current = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearHeldKeys);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearHeldKeys);
    };
  }, []);

  useFrame((_, delta) => {
    const held = keys.current;
    if (!controls || held.size === 0) return;

    // Flattened to the ground plane so panning stays level regardless of
    // how far down the camera is tilted -- otherwise "forward" would drive
    // the view into the floor at steep angles.
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    // Looking straight down leaves nothing to flatten; fall back to the
    // rig's default facing so the keys still do something sensible.
    if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
    _forward.normalize();
    _right.crossVectors(_forward, _up).normalize();

    _move.set(0, 0, 0);
    if (held.has("w") || held.has("arrowup")) _move.add(_forward);
    if (held.has("s") || held.has("arrowdown")) _move.sub(_forward);
    if (held.has("d") || held.has("arrowright")) _move.add(_right);
    if (held.has("a") || held.has("arrowleft")) _move.sub(_right);
    if (_move.lengthSq() === 0) return;

    const distance = camera.position.distanceTo(controls.target);
    const speed = PAN_SPEED * distance * (boost.current ? BOOST_MULTIPLIER : 1);
    _move.normalize().multiplyScalar(speed * delta);

    // Both ends move together: shifting the target alone would swing the
    // camera around it, which is orbiting, not panning.
    camera.position.add(_move);
    controls.target.add(_move);
  });

  return null;
}
