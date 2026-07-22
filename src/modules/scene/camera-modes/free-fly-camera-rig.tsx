"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";

const MOVE_SPEED = 24; // m/s
const BOOST_MULTIPLIER = 2.5;
const LOOK_SENSITIVITY = 0.0025;
// Caps how much a single pointermove event can rotate the view. A real
// mouse reports many small events per drag; anything reporting a bigger
// single-event jump than this is almost certainly a spurious/duplicated
// event rather than intentional fast movement, so clamping protects
// against a runaway spin without perceptibly limiting normal use.
const MAX_LOOK_DELTA_PX = 40;

// FPS-style free camera: WASD (+ Space/Ctrl for up/down, Shift to boost)
// moves, hold the RIGHT mouse button and drag to look around. Right-click
// specifically (not left, not pointer-lock) so it can't collide with any
// tool's left-click interactions (placing a point/object, etc.) -- those
// keep working normally while free-flying over the scene, and there's no
// browser Pointer Lock request to fail/deny in a way that'd need its own
// fallback UI.
export function FreeFlyCameraRig() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const { gl } = useThree();

  const yaw = useRef(Math.PI); // facing -Z initially, matching the orbit rig's default look direction
  const pitch = useRef(-0.35);
  const keys = useRef(new Set<string>());
  const looking = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(18, 14, 18);
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    function onKeyDown(e: KeyboardEvent) {
      keys.current.add(e.key.toLowerCase());
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.current.delete(e.key.toLowerCase());
    }
    function onPointerDown(e: PointerEvent) {
      if (e.button !== 2) return;
      looking.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
    function onPointerUp(e: PointerEvent) {
      if (e.button !== 2) return;
      looking.current = false;
      canvas.releasePointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!looking.current) return;
      // Computed from clientX/clientY rather than movementX/movementY --
      // deriving the delta ourselves works identically regardless of how
      // reliably a given browser/input source populates movementX/Y under
      // pointer capture, so there's one less variable to trust.
      const dx = THREE.MathUtils.clamp(e.clientX - lastPointer.current.x, -MAX_LOOK_DELTA_PX, MAX_LOOK_DELTA_PX);
      const dy = THREE.MathUtils.clamp(e.clientY - lastPointer.current.y, -MAX_LOOK_DELTA_PX, MAX_LOOK_DELTA_PX);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * LOOK_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - dy * LOOK_SENSITIVITY,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault(); // right-click drives looking, not a browser context menu
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera) return;

    const euler = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw.current, 0));

    const k = keys.current;
    const move = new THREE.Vector3();
    if (k.has("w") || k.has("arrowup")) move.add(forward);
    if (k.has("s") || k.has("arrowdown")) move.sub(forward);
    if (k.has("d") || k.has("arrowright")) move.add(right);
    if (k.has("a") || k.has("arrowleft")) move.sub(right);
    if (k.has(" ")) move.y += 1;
    if (k.has("control")) move.y -= 1;

    if (move.lengthSq() > 0) {
      const speed = MOVE_SPEED * (k.has("shift") ? BOOST_MULTIPLIER : 1);
      move.normalize().multiplyScalar(speed * delta);
      camera.position.add(move);
    }
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={60} position={[18, 14, 18]} />;
}
