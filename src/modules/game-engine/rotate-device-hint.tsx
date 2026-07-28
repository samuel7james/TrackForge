"use client";

import { RotateCcw } from "lucide-react";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";

// Driving is meaningfully better in landscape (wider view of what's ahead,
// the touch joystick has more room), so touch users starting a lap in
// portrait get a brief nudge -- not a blocker, since the game is still
// fully playable in portrait. `portrait:flex` (a built-in Tailwind variant,
// not a custom one) handles hiding it again immediately on rotation; the
// animation handles the same for someone who stays in portrait, so it never
// lingers as a permanent nag.
export function RotateDeviceHint() {
  const isTouchDevice = useIsTouchDevice();
  if (!isTouchDevice) return null;

  return (
    // Vertical center, not a top/bottom edge -- every edge is already
    // claimed by a fixed HUD element (header, lap timer, minimap, stats
    // toggle, joystick spawn area), so the middle of the screen is the one
    // spot guaranteed clear of all of them.
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 animate-[rotate-hint-fade_4.5s_ease-out_forwards] justify-center portrait:flex">
      <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/90 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-xl">
        <RotateCcw className="size-3.5" />
        Rotate your device for the best view of the track
      </div>
    </div>
  );
}
