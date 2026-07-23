"use client";

import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import type { Controls } from "./controls";

// Touch capability never changes over a page's lifetime, so there's nothing
// to subscribe to -- this only exists to give useSyncExternalStore the
// browser-vs-server snapshot split it needs to read `window` without a
// hydration mismatch (the standard React 19 idiom for a browser-only
// capability check, cleaner than a state+effect pair here since there's no
// actual external store to subscribe to).
function subscribeNever() {
  return () => {};
}
function getTouchSnapshot() {
  return "ontouchstart" in window;
}
function getTouchServerSnapshot() {
  return false;
}

// Themed replacement for Controls' own setupTouchUI() (raw injected <style>/
// <div>s, see controls.ts) -- the pointer-math itself still lives on
// Controls (handleSteerStart/Move/End); this only draws the joystick and
// forwards pointer events into those methods, reading touchDirX/touchDirY/
// touchActive back out each frame the same rAF-tick-mutates-a-ref pattern
// hud-overlay.tsx uses.
export function TouchControlsOverlay({ controls }: { controls: Controls }) {
  const isTouchDevice = useSyncExternalStore(subscribeNever, getTouchSnapshot, getTouchServerSnapshot);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTouchDevice) return;

    let frameId: number;

    function tick() {
      const base = baseRef.current;
      const knob = knobRef.current;

      if (base) base.style.display = controls.touchActive ? "block" : "none";
      if (knob) {
        knob.style.transform = `translate(${controls.touchDirX * 60}px, ${controls.touchDirY * 60}px)`;
      }

      frameId = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(frameId);
  }, [isTouchDevice, controls]);

  if (!isTouchDevice) return null;

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    controls.handleSteerStart(e.pointerId, e.clientX, e.clientY);
    if (baseRef.current) {
      baseRef.current.style.left = `${e.clientX}px`;
      baseRef.current.style.top = `${e.clientY}px`;
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    controls.handleSteerMove(e.pointerId, e.clientX, e.clientY);
  }

  function handlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    controls.handleSteerEnd(e.pointerId);
  }

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        ref={baseRef}
        style={{ display: "none" }}
        className="absolute h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20 bg-white/10"
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35"
        />
      </div>
    </div>
  );
}
