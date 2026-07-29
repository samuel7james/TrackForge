"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";
import { createEngine, type EngineHandle } from "./engine-core";
import type { Cell } from "./track";
import { HudOverlay } from "./hud-overlay";
import { SessionStatsPanel } from "./session-stats-panel";
import { TouchControlsOverlay } from "./touch-controls-overlay";
import { MiniMap } from "./mini-map";
import { RotateDeviceHint } from "./rotate-device-hint";
import { StartCountdown } from "./start-countdown";
import { TuningPanel } from "./tuning-panel";

export interface EngineMountProps {
  /** null/omitted plays the reference's own built-in demo grid. */
  mapCells?: Cell[] | null;
  trackId?: string | null;
  /** Forwarded to createEngine -- see EngineOptions for the anti-inflation
   * reasoning behind gating this on "real play" only. */
  submitLapTimes?: boolean;
  displayName?: string | null;
  onDisplayNameInvalid?: () => void;
}

// Owns a <canvas> and the vendored engine's whole imperative lifecycle --
// construct on mount, dispose on unmount. mapCells/trackId are read
// once at mount time, not reactively: a track only ever needs to change
// when a new Play session starts, which the codebase already treats as
// "remount the whole thing fresh" (see ModeController/Vehicle), so a parent
// switching tracks should change this component's `key` to force a remount
// rather than expecting props to hot-swap an already-running engine.
export function EngineMount({
  mapCells = null,
  trackId = null,
  submitLapTimes = false,
  displayName = null,
  onDisplayNameInvalid,
}: EngineMountProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<EngineHandle | null>(null);
  const [handle, setHandle] = useState<EngineHandle | null>(null);
  const isTouchDevice = useIsTouchDevice();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const abortController = new AbortController();
    let cancelled = false;

    createEngine({
      canvas,
      mapCells,
      trackId,
      submitLapTimes,
      displayName,
      onDisplayNameInvalid,
      mobileMode: isTouchDevice,
      signal: abortController.signal,
    }).then((createdHandle) => {
      if (cancelled) {
        createdHandle.dispose();
        return;
      }
      handleRef.current = createdHandle;
      setHandle(createdHandle);
    });

    return () => {
      cancelled = true;
      abortController.abort();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <canvas
        ref={canvasRef}
        // Without these, a long-press anywhere on the canvas (most of the
        // screen, now that touch input is a few small buttons rather than
        // one full-screen capture div) is fair game for the browser's own
        // touch gestures -- e.g. Android/Chrome's "Download/Share/Print"
        // image callout, or iOS Safari's own long-press menu/selection --
        // same as long-pressing any other image, since a <canvas> is one
        // as far as the browser's concerned. contextmenu is also blocked
        // outright since a right-click during play is never meant to open
        // a menu either.
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />
      {!handle && (
        // createEngine's model-loading Promise.all (vehicle/track/scenery
        // GLBs) can take a real, visible moment on a cold cache/slow
        // connection -- without this the canvas just sits there black
        // with zero feedback, which reads as broken rather than loading.
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          Loading track…
        </div>
      )}
      {handle && (
        <>
          <HudOverlay lapTimer={handle.lapTimer} />
          <SessionStatsPanel stats={handle.sessionStats} />
          <TouchControlsOverlay controls={handle.controls} />
          {!isTouchDevice && (
            // Touch devices get the close, heading-relative chase camera
            // instead (see mobileCamera above) -- that framing already
            // shows more of the track ahead than the desktop's pulled-back
            // angle did, so the minimap's screen space goes back to the
            // player instead of duplicating that job.
            <MiniMap
              cells={mapCells}
              vehiclePosition={handle.vehiclePosition}
              vehicleQuaternion={handle.vehicleQuaternion}
            />
          )}
          <RotateDeviceHint />
          <StartCountdown controls={handle.controls} />
          <TuningPanel />
        </>
      )}
    </div>
  );
}
