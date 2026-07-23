"use client";

import { useEffect, useRef } from "react";
import { createEngine, type EngineHandle } from "./engine-core";
import type { Cell } from "./track";

export interface EngineMountProps {
  /** null/omitted plays the reference's own built-in demo grid. */
  mapCells?: Cell[] | null;
  trackId?: string | null;
}

// Owns a <canvas> and the vendored engine's whole imperative lifecycle --
// construct on mount, dispose on unmount. mapCells/trackId are read once at
// mount time, not reactively: a track only ever needs to change when a new
// Play session starts, which the codebase already treats as "remount the
// whole thing fresh" (see ModeController/Vehicle), so a parent switching
// tracks should change this component's `key` to force a remount rather
// than expecting props to hot-swap an already-running engine.
export function EngineMount({ mapCells = null, trackId = null }: EngineMountProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let handle: EngineHandle | null = null;

    createEngine({ canvas, mapCells, trackId }).then((createdHandle) => {
      if (cancelled) {
        createdHandle.dispose();
        return;
      }
      handle = createdHandle;
    });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
