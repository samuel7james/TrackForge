"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";
import type { Controls } from "./controls";

// Themed replacement for Controls' own setupTouchUI() (raw injected <style>/
// <div>s, see controls.ts) -- the pointer-math itself still lives on
// Controls (handleSteerStart/Move/End); this only draws the joystick and
// forwards pointer events into those methods, reading touchDirX/touchDirY/
// touchActive back out each frame the same rAF-tick-mutates-a-ref pattern
// hud-overlay.tsx uses.
export function TouchControlsOverlay({ controls }: { controls: Controls }) {
  const isTouchDevice = useIsTouchDevice();
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
      // No z-index: stacks above the plain canvas (paints later in DOM,
      // same implicit z-index) but below the HUD/stats/minimap panels'
      // explicit z-10 -- otherwise this full-screen capture surface (needed
      // so a steering touch can start anywhere) swallows every tap meant for
      // the session-stats toggle button before it ever reaches it.
      className="absolute inset-0"
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
