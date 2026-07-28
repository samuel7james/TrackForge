"use client";

import { ChevronLeft, ChevronRight, Octagon } from "lucide-react";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";
import type { Controls } from "./controls";

// Steer left/right, hold to brake -- throttle itself is automatic (see
// Controls.update's autoThrottle), so there's no accelerate button at all.
// Replaced an earlier single free-drag joystick that mapped its direction
// onto world-space axes (tuned for the old fixed-angle camera, and
// reportedly felt inverted even before that) -- these buttons instead
// drive plain relative left/right steering, the same x/z keyboard already
// used, so there's only one steering model to tune rather than two.
function TouchButton({
  label,
  className,
  icon: Icon,
  onDown,
  onUp,
}: {
  label: string;
  className: string;
  icon: typeof ChevronLeft;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      // Size is part of the per-button className (not a fixed base class
      // here) -- two conflicting Tailwind size-* utilities in one class
      // string race on generated-CSS order, not class-attribute order, so
      // whichever one "wins" isn't reliably the one passed in last.
      className={`absolute flex items-center justify-center rounded-full border border-white/15 bg-white/10 text-white active:bg-white/25 ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      <Icon className="size-9" />
    </button>
  );
}

export function TouchControlsOverlay({ controls }: { controls: Controls }) {
  const isTouchDevice = useIsTouchDevice();
  if (!isTouchDevice) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <TouchButton
        label="Steer left"
        className="bottom-6 left-6 size-20"
        icon={ChevronLeft}
        onDown={() => controls.setTouchLeft(true)}
        onUp={() => controls.setTouchLeft(false)}
      />
      <TouchButton
        label="Steer right"
        className="bottom-6 right-6 size-20"
        icon={ChevronRight}
        onDown={() => controls.setTouchRight(true)}
        onUp={() => controls.setTouchRight(false)}
      />
      <TouchButton
        label="Brake"
        className="bottom-8 left-1/2 -translate-x-1/2 size-16"
        icon={Octagon}
        onDown={() => controls.setTouchBrake(true)}
        onUp={() => controls.setTouchBrake(false)}
      />
    </div>
  );
}
