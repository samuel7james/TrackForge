"use client";

import { useEffect, useRef, useState } from "react";
import { ChartNoAxesColumn } from "lucide-react";
import type { SessionStats } from "./session-stats";
import { formatLapTime } from "./lap-timer";

// Same rAF-tick-over-refs pattern as hud-overlay.tsx (reads SessionStats'
// plain public fields every frame via refs, not React state, to avoid a
// re-render per frame). Collapsed by default behind a toggle, opposite
// corner from HudOverlay, so it doesn't compete with the always-visible
// lap timer.
export function SessionStatsPanel({ stats }: { stats: SessionStats }) {
  const [open, setOpen] = useState(false);
  const topSpeedRef = useRef<HTMLSpanElement>(null);
  const avgSpeedRef = useRef<HTMLSpanElement>(null);
  const lapListRef = useRef<HTMLUListElement>(null);
  const lapCountRef = useRef(0);

  useEffect(() => {
    if (!stats.enabled) return;

    let frameId: number;

    function tick() {
      if (topSpeedRef.current) topSpeedRef.current.textContent = `${Math.round(stats.topSpeedPct)}%`;
      if (avgSpeedRef.current) avgSpeedRef.current.textContent = `${Math.round(stats.avgSpeedPct)}%`;

      if (stats.laps.length !== lapCountRef.current && lapListRef.current) {
        lapCountRef.current = stats.laps.length;
        lapListRef.current.innerHTML = "";
        for (const lap of [...stats.laps].reverse()) {
          const li = document.createElement("li");
          li.className = "flex items-center justify-between gap-3 tabular-nums";
          const label = document.createElement("span");
          label.className = "text-muted-foreground";
          label.textContent = `Lap ${lap.lapNumber}`;
          const time = document.createElement("span");
          time.className = lap.isBest ? "font-medium text-emerald-400" : "font-medium";
          time.textContent = formatLapTime(lap.timeMs / 1000);
          li.append(label, time);
          lapListRef.current.appendChild(li);
        }
      }

      frameId = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(frameId);
  }, [stats]);

  if (!stats.enabled) return null;

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
      {open && (
        <div className="w-56 rounded-2xl border border-border/50 bg-card/80 p-4 text-foreground shadow-lg backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs tabular-nums">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Top speed</span>
              <span ref={topSpeedRef} className="text-lg font-bold">0%</span>
            </div>
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-muted-foreground">Avg speed</span>
              <span ref={avgSpeedRef} className="text-lg font-bold">0%</span>
            </div>
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lap history
          </div>
          <ul ref={lapListRef} className="mt-1 flex max-h-32 flex-col gap-1 overflow-y-auto text-xs" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-card/80 text-foreground shadow-lg backdrop-blur-xl hover:bg-card"
        title="Session stats"
      >
        <ChartNoAxesColumn className="size-4" />
      </button>
    </div>
  );
}
