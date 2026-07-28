"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";

// Matches StartCountdown's total run time (STEPS.length * STEP_MS) -- both
// mount at the same moment (a play session starting), and both want the
// screen's dead center, so this one waits its turn rather than overlapping
// the countdown number.
const START_DELAY_MS = 3200;

// Driving is meaningfully better in landscape (wider view of what's ahead,
// the touch controls have more room), so touch users starting a lap in
// portrait get a brief nudge -- not a blocker, since the game is still
// fully playable in portrait. `portrait:flex` (a built-in Tailwind variant,
// not a custom one) handles hiding it again immediately on rotation; the
// animation handles the same for someone who stays in portrait, so it never
// lingers as a permanent nag.
export function RotateDeviceHint() {
  const isTouchDevice = useIsTouchDevice();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isTouchDevice || !ready) return null;

  return (
    // Vertical center, not a top/bottom edge -- every edge is already
    // claimed by a fixed HUD element (header, lap timer, stats toggle,
    // steer/brake buttons), so the middle of the screen is the one spot
    // guaranteed clear of all of them.
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 animate-[rotate-hint-fade_4.5s_ease-out_forwards] justify-center portrait:flex">
      <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/90 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-xl">
        <RotateCcw className="size-3.5" />
        Rotate your device for the best view of the track
      </div>
    </div>
  );
}
