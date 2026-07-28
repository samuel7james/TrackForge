"use client";

import { useEffect, useState } from "react";
import type { Controls } from "./controls";

const STEPS = ["3", "2", "1", "GO"] as const;
const STEP_MS = 800;

// Freezes input (Controls.frozen) for the first few steps so a player can't
// jump-start by holding a direction/brake before "GO" -- unfrozen exactly
// when "GO" appears, not after it fades, so the count and actual control
// feel like they agree with each other. Runs once per play session (this
// mounts fresh alongside EngineMount, which itself remounts per session --
// see its own comment), not per lap.
export function StartCountdown({ controls }: { controls: Controls }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    controls.setFrozen(true);

    const timers = STEPS.map((_, i) => setTimeout(() => setStepIndex(i), i * STEP_MS));
    timers.push(setTimeout(() => controls.setFrozen(false), (STEPS.length - 1) * STEP_MS));
    timers.push(setTimeout(() => setVisible(false), STEPS.length * STEP_MS));

    return () => {
      timers.forEach(clearTimeout);
      controls.setFrozen(false);
    };
  }, [controls]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/25">
      <span
        key={stepIndex}
        className="animate-in zoom-in fade-in text-9xl font-black text-white duration-300 [text-shadow:0_4px_24px_rgba(0,0,0,0.6)]"
      >
        {STEPS[stepIndex]}
      </span>
    </div>
  );
}
