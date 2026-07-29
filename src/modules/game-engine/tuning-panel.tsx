"use client";

import { useEffect, useState } from "react";
import { tuning, resetTuning, SCALE_MIN, SCALE_MAX } from "./tuning";

// Adjusts the two multipliers in tuning.ts live, mid-drive. Opened with
// Alt+X and closed the same way; there is deliberately no button, hint, or
// any other affordance pointing at it anywhere in the UI, so it stays out
// of the way of normal play entirely.
//
// Returns null while closed rather than rendering something hidden -- there
// is then no element in the DOM to notice at all until it's actually opened.
export function TuningPanel() {
  const [open, setOpen] = useState(false);
  // The sliders write straight into the tuning singleton (the render loop
  // reads it every frame, outside React), so this exists only to repaint the
  // slider positions/readouts -- the values themselves don't live in state.
  const [, repaint] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.code !== "KeyX" || e.repeat) return;
      e.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const row = (label: string, key: "speedScale" | "accelScale") => (
    <label className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[0.7rem] text-muted-foreground">{label}</span>
      <input
        type="range"
        min={SCALE_MIN}
        max={SCALE_MAX}
        step={0.1}
        value={tuning[key]}
        onChange={(e) => {
          tuning[key] = Number(e.target.value);
          repaint((n) => n + 1);
        }}
        className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
      />
      <span className="w-8 shrink-0 text-right font-mono text-[0.7rem] tabular-nums">
        {tuning[key].toFixed(1)}×
      </span>
    </label>
  );

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-col gap-2 rounded-xl border border-border/50 bg-card/80 px-3 py-2.5 shadow-lg backdrop-blur-xl">
      {row("Speed", "speedScale")}
      {row("Accel", "accelScale")}
      <button
        onClick={() => {
          resetTuning();
          repaint((n) => n + 1);
        }}
        className="self-end text-[0.7rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        Reset
      </button>
    </div>
  );
}
