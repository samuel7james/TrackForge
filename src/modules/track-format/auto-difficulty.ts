import type { Cell } from "@/modules/game-engine/track";
import type { Difficulty } from "./schema";

// Two turns in the same rotational direction separated by at most this many
// straight cells read as one continuous hairpin (a tight U); opposite-
// direction turns that close this fast form an S-curve chicane instead.
// Anything wider than this gap is just two independent corners.
const TIGHT_GAP_THRESHOLD = 1;

interface TurnEvent {
  sign: 1 | -1;
  index: number;
}

function keyOf(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

// Reconstructs the closed lap loop purely from orthogonal grid adjacency --
// every track piece (straight, corner, bump, finish) connects to exactly
// the two neighbor cells its road surface actually spans, regardless of
// which way it's rotated for art purposes (verified by hand against the
// game's own TRACK_CELLS sample track, whose 6 "track-corner" pieces are
// exactly the 6 cells this walk finds a direction change at). Returns null
// for anything that isn't one clean single loop -- branches, dead ends, or
// disconnected islands mean the layout isn't drivable as one lap yet, and
// callers fall back to a cruder corner-density estimate rather than
// guessing at a broken path.
function walkLoop(cells: Cell[]): Cell[] | null {
  if (cells.length < 4) return null;

  const byKey = new Map<string, Cell>();
  for (const cell of cells) byKey.set(keyOf(cell[0], cell[1]), cell);

  const neighborsOf = (cell: Cell): Cell[] => {
    const [gx, gz] = cell;
    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const found: Cell[] = [];
    for (const [ox, oz] of offsets) {
      const neighbor = byKey.get(keyOf(gx + ox, gz + oz));
      if (neighbor) found.push(neighbor);
    }
    return found;
  };

  for (const cell of cells) {
    if (neighborsOf(cell).length !== 2) return null;
  }

  const start = cells.find((c) => c[2] === "track-finish") ?? cells[0];
  const path: Cell[] = [start];
  let prev: Cell | null = null;
  let current = start;

  while (path.length <= cells.length) {
    const neighbors = neighborsOf(current);
    const next = neighbors.find((n) => !prev || n[0] !== prev[0] || n[1] !== prev[1]);
    if (!next) return null;
    if (next[0] === start[0] && next[1] === start[1]) {
      return path.length === cells.length ? path : null;
    }
    path.push(next);
    prev = current;
    current = next;
  }

  return null;
}

// Sign of the turn at `b`, purely from the grid direction change between
// segment a->b and segment b->c -- 0 for straight-through, ±1 for a 90°
// turn one way or the other. Grid pieces only ever produce these three
// outcomes (see walkLoop's own comment), never a single-cell reversal.
function turnSign(a: Cell, b: Cell, c: Cell): 0 | 1 | -1 {
  const inX = Math.sign(b[0] - a[0]);
  const inZ = Math.sign(b[1] - a[1]);
  const outX = Math.sign(c[0] - b[0]);
  const outZ = Math.sign(c[1] - b[1]);
  const cross = inX * outZ - inZ * outX;
  if (cross > 0) return 1;
  if (cross < 0) return -1;
  return 0;
}

function analyzeLoop(path: Cell[]): {
  solo: number;
  chicanes: number;
  hairpins: number;
  totalCells: number;
} {
  const n = path.length;
  const events: TurnEvent[] = [];
  for (let i = 0; i < n; i++) {
    const a = path[(i - 1 + n) % n];
    const b = path[i];
    const c = path[(i + 1) % n];
    const sign = turnSign(a, b, c);
    if (sign !== 0) events.push({ sign, index: i });
  }

  let solo = 0;
  let chicanes = 0;
  let hairpins = 0;
  let i = 0;
  while (i < events.length) {
    const current = events[i];
    const nextEvent = events[i + 1];
    if (nextEvent) {
      const gap = (nextEvent.index - current.index - 1 + n) % n;
      if (gap <= TIGHT_GAP_THRESHOLD) {
        if (nextEvent.sign === current.sign) hairpins++;
        else chicanes++;
        i += 2;
        continue;
      }
    }
    solo++;
    i += 1;
  }

  return { solo, chicanes, hairpins, totalCells: n };
}

// Difficulty is derived from the layout, never chosen by the creator --
// there's no editor UI for it at all (track-store.ts's setMeta is only
// ever called with `name`), so it always reflects whatever's actually
// built. Recomputed on every save rather than cached: it's a single pass
// over the cell list, and any edit can change the corner geometry.
//
// Weights and thresholds below are a tuned-by-feel heuristic, not a
// derived constant -- there's no ground-truth difficulty rating to fit
// against, just the intent that hairpins > chicanes > plain corners, and
// that the same feature count matters more on a short, dense track than
// spread across a long one.
export function computeTrackDifficulty(cells: Cell[]): Difficulty {
  const path = walkLoop(cells);

  let technicality: number;
  let density: number;

  if (path) {
    const { solo, chicanes, hairpins, totalCells } = analyzeLoop(path);
    technicality = solo * 1 + chicanes * 2.5 + hairpins * 3.5;
    const turnCells = solo + chicanes * 2 + hairpins * 2;
    density = totalCells > 0 ? turnCells / totalCells : 0;
  } else {
    // Not a single clean loop (still saveable as an in-progress draft) --
    // no path order to cluster turns along, so fall back to raw corner
    // proportion instead of guessing at a broken layout.
    const cornerCount = cells.filter((c) => c[2] === "track-corner").length;
    technicality = cornerCount;
    density = cells.length > 0 ? cornerCount / cells.length : 0;
  }

  const score = technicality * (0.6 + density * 1.5);

  if (score < 5) return "beginner";
  if (score < 12) return "intermediate";
  if (score < 22) return "advanced";
  return "expert";
}
