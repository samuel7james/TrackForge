"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRaceStore } from "@/store/race-store";

function formatTime(ms: number | null): string {
  if (ms === null) return "--:--.---";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

export function RaceHud() {
  const lapStartTime = useRaceStore((s) => s.lapStartTime);
  const lastLapTimeMs = useRaceStore((s) => s.lastLapTimeMs);
  const bestLapTimeMs = useRaceStore((s) => s.bestLapTimeMs);
  const lastSectorDelta = useRaceStore((s) => s.lastSectorDelta);
  const clearSectorDelta = useRaceStore((s) => s.clearSectorDelta);

  const liveTimeRef = useRef<HTMLSpanElement>(null);

  // Live tick via rAF mutating a ref directly, not React state -- the timer
  // display updates every frame without re-rendering the rest of the HUD.
  useEffect(() => {
    let frameId: number;
    function tick() {
      if (liveTimeRef.current) {
        const elapsed = lapStartTime === null ? null : performance.now() - lapStartTime;
        liveTimeRef.current.textContent = formatTime(elapsed);
      }
      frameId = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(frameId);
  }, [lapStartTime]);

  useEffect(() => {
    if (!lastSectorDelta) return;
    const timeout = setTimeout(clearSectorDelta, 2500);
    return () => clearTimeout(timeout);
  }, [lastSectorDelta, clearSectorDelta]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-6 flex -translate-x-1/2 flex-col items-center gap-1">
      <span
        ref={liveTimeRef}
        className="font-mono text-3xl font-semibold tabular-nums text-foreground"
      >
        --:--.---
      </span>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>Last {formatTime(lastLapTimeMs)}</span>
        <span>Best {formatTime(bestLapTimeMs)}</span>
      </div>
      <AnimatePresence>
        {lastSectorDelta && (
          <motion.span
            key={`${lastSectorDelta.sectorIndex}-${lastSectorDelta.deltaMs}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={cn(
              "text-sm font-medium tabular-nums",
              lastSectorDelta.deltaMs <= 0 ? "text-emerald-400" : "text-amber-400"
            )}
          >
            {lastSectorDelta.deltaMs <= 0 ? "" : "+"}
            {(lastSectorDelta.deltaMs / 1000).toFixed(3)}s
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
