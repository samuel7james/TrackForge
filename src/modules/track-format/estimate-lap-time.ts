import type { Cell } from "@/modules/game-engine/track";

// A rough, clearly-approximate guide shown on a track's public page --
// not a promise. There's no reliable way to derive this from the actual
// vehicle physics (a rolling-sphere model driven by an indirect angular-
// velocity target, not a simple top-speed constant), so this is a plain
// "seconds per cell at a moderate, corners-included pace" heuristic,
// tunable later against real recorded lap times if it turns out to be
// off -- same honest framing as auto-difficulty.ts's own scoring weights.
const SECONDS_PER_CELL = 1.1;

export function estimateLapTimeMs(cells: Cell[]): number | null {
  if (cells.length === 0) return null;
  return Math.round(cells.length * SECONDS_PER_CELL * 1000);
}
