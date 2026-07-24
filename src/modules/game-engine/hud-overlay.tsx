"use client";

import { useEffect, useRef } from "react";
import type { LapTimer } from "./lap-timer";
import { formatLapTime } from "./lap-timer";

// Themed replacement for LapTimer's own buildUI() (raw injected <style>/
// <div>, see lap-timer.ts) -- reads the same plain public fields every
// frame via refs mutated directly (not React state), the same rAF-tick
// pattern TrackForge's own race-hud.tsx already uses for its live timer.
export function HudOverlay({ lapTimer }: { lapTimer: LapTimer }) {
  const lapElRef = useRef<HTMLSpanElement>(null);
  const currentElRef = useRef<HTMLDivElement>(null);
  const lastElRef = useRef<HTMLSpanElement>(null);
  const bestElRef = useRef<HTMLSpanElement>(null);
  const prevLapRef = useRef(lapTimer.lap);

  useEffect(() => {
    if (!lapTimer.enabled) return;

    let frameId: number;

    function tick() {
      if (lapElRef.current) lapElRef.current.textContent = String(lapTimer.lap);
      if (currentElRef.current) currentElRef.current.textContent = formatLapTime(lapTimer.currentLapTime);
      if (lastElRef.current) lastElRef.current.textContent = formatLapTime(lapTimer.lastLap);
      if (bestElRef.current) bestElRef.current.textContent = formatLapTime(lapTimer.bestLap);

      if (lapTimer.lap !== prevLapRef.current) {
        prevLapRef.current = lapTimer.lap;
        const color = lapTimer.lastLapWasBest ? "#34d399" : "#f87171";
        currentElRef.current?.animate([{ color }, { color }, { color: "inherit" }], {
          duration: 1200,
          easing: "ease-out",
        });
      }

      frameId = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(frameId);
  }, [lapTimer]);

  if (!lapTimer.enabled) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-20 z-10 min-w-[150px] rounded-2xl border border-border/50 bg-card/80 px-4 py-3 text-foreground shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Lap</span>
        <span ref={lapElRef}>1</span>
      </div>
      <div ref={currentElRef} className="my-1 font-mono text-2xl font-bold tabular-nums">
        0:00.00
      </div>
      <div className="flex items-center justify-between gap-3 text-xs tabular-nums text-muted-foreground">
        <span>Last</span>
        <span ref={lastElRef}>0:00.00</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs tabular-nums text-muted-foreground">
        <span>Best</span>
        <span ref={bestElRef}>0:00.00</span>
      </div>
    </div>
  );
}
