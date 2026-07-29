import type { Cell } from "@/modules/game-engine/track";
import { gridToCells, placeRoadCell, placeFinishCell, type Grid } from "@/modules/game-engine/autotile";
import { computeTrackDifficulty } from "./auto-difficulty";
import type { Difficulty } from "./schema";

export const DIFFICULTY_TIERS: Difficulty[] = ["beginner", "intermediate", "advanced", "expert"];

// The daily challenge only ever draws from the top two tiers. It's the one
// track everybody races on the same day, so it's meant to be a test --
// beginner and intermediate layouts (long straights, a couple of gentle
// corners) make for a dull thing to compete over, and there are plenty of
// player-built tracks at those levels already. The full four tiers still
// exist for everything else that generates a layout.
export const DAILY_CHALLENGE_TIERS: Difficulty[] = ["advanced", "expert"];

function tierRank(difficulty: Difficulty): number {
  return DIFFICULTY_TIERS.indexOf(difficulty);
}

interface SizeRange {
  min: number;
  max: number;
}

interface DifficultyParams {
  size: SizeRange;
  notches: SizeRange;
}

// Bigger rectangle + fewer notches reads as long straights with a handful
// of gentle corners (beginner); smaller + more notches packs more turns
// into a shorter lap (expert). Tuned by feel against computeTrackDifficulty's
// own thresholds (see the retry loop below), not derived from anything --
// same honest framing as that file's own scoring weights.
const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  beginner: { size: { min: 7, max: 11 }, notches: { min: 0, max: 1 } },
  intermediate: { size: { min: 7, max: 11 }, notches: { min: 1, max: 2 } },
  advanced: { size: { min: 5, max: 8 }, notches: { min: 3, max: 5 } },
  // A tiny rectangle actually leaves LESS room for notches (they need
  // spacing to avoid colliding), capping how technical it can get --
  // expert needs a wider edge to fit enough of them on, and gets there
  // on raw corner count/density rather than a smaller footprint.
  expert: { size: { min: 6, max: 10 }, notches: { min: 8, max: 14 } },
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Non-overlapping notch positions along an edge of the given length,
// staying away from the two corners at each end. A notch's two legs sit
// at k and k+2 (not k and k+1 -- see buildWaypoints' own comment on why
// that gap matters), so the next notch needs to start at k+3 or later to
// avoid sharing a leg column with this one.
function pickNotchPositions(edgeLength: number, count: number): number[] {
  const candidates: number[] = [];
  for (let k = 1; k <= edgeLength - 4; k++) candidates.push(k);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const chosen: number[] = [];
  for (const k of candidates) {
    if (chosen.length >= count) break;
    if (chosen.every((c) => Math.abs(c - k) >= 3)) chosen.push(k);
  }
  return chosen.sort((a, b) => a - b);
}

// A closed rectilinear loop -- a width x height rectangle's perimeter with
// small outward detours ("notches") spliced into the top and bottom
// edges. Self-avoiding and closed by construction: a plain rectangle
// perimeter never crosses itself, and a notch only ever pushes outward
// (away from the rectangle interior, never across it). Each notch's two
// "legs" sit 2 columns apart (k and k+2, with k+1 excluded from the base
// row entirely) rather than adjacent columns -- a 1-column-wide notch's
// two legs would themselves be grid-adjacent even though they're not
// consecutive in the path, silently creating a branch (some cell with 3
// neighbors instead of 2) that isn't a clean loop at all, just because
// two unrelated parts of the perimeter happen to touch. Returns
// waypoints, not individual cells -- every consecutive pair is an axis-
// aligned straight run, interpolated below.
function buildWaypoints(width: number, height: number, topNotches: number[], bottomNotches: number[]): [number, number][] {
  const waypoints: [number, number][] = [[0, 0]];

  for (const k of topNotches) {
    waypoints.push([k, 0], [k, -1], [k + 2, -1], [k + 2, 0]);
  }
  waypoints.push([width - 1, 0]);
  waypoints.push([width - 1, height - 1]);

  for (const k of [...bottomNotches].reverse()) {
    waypoints.push([k + 2, height - 1], [k + 2, height], [k, height], [k, height - 1]);
  }
  waypoints.push([0, height - 1]);
  waypoints.push([0, 0]);

  return waypoints;
}

function interpolateWaypoints(waypoints: [number, number][]): [number, number][] {
  const points: [number, number][] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const [px, pz] = points[points.length - 1];
    const [nx, nz] = waypoints[i];
    const dx = Math.sign(nx - px);
    const dz = Math.sign(nz - pz);
    let x = px;
    let z = pz;
    while (x !== nx || z !== nz) {
      x += dx;
      z += dz;
      points.push([x, z]);
    }
  }
  // Last point duplicates the first (closes the loop) -- drop it, the
  // renderer/adjacency logic treats the cell list as an implicit cycle.
  points.pop();
  return points;
}

// Verifies the generated path is a single, clean closed loop by the same
// standard the rest of the app actually requires (see auto-difficulty.ts's
// walkLoop): every cell distinct, and every cell orthogonally adjacent to
// EXACTLY two others in the full cell set -- not just its immediate
// predecessor/successor in path order. That distinction matters: two
// unrelated parts of the path can end up next to each other on the grid
// without being consecutive steps, which reads as a clean loop by a
// weaker "just check consecutive path entries" test while actually being
// a branch (some cell with 3 neighbors) that isn't a real single loop at
// all -- which is exactly the bug a too-narrow notch produced here.
function isValidLoop(points: [number, number][]): boolean {
  if (points.length < 4) return false;

  const seen = new Set<string>();
  for (const [x, z] of points) {
    const key = `${x},${z}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }

  for (const [gx, gz] of points) {
    const offsets: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let degree = 0;
    for (const [ox, oz] of offsets) {
      if (seen.has(`${gx + ox},${gz + oz}`)) degree++;
    }
    if (degree !== 2) return false;
  }

  return true;
}

// The path always starts at (0,0), one of the rectangle's own corners --
// but the finish cell has to land on a straight-through point, not a
// corner: placeFinishCell marks a cell finish, but resolveCell (autotile.ts)
// only *keeps* that marking if the auto-tiled shape it resolves to is a
// straight (a corner-shaped finish silently reverts to a plain corner,
// dropping the finish line -- and with it, LapTimer.enabled -- entirely).
// The left edge never gets notches (only top/bottom do, see buildWaypoints),
// so its midpoint is always a safe straight run to rotate the cycle onto
// before designating a starting point as finish.
function rotateToSafeFinishStart(points: [number, number][], height: number): [number, number][] {
  const targetZ = Math.floor(height / 2);
  const index = points.findIndex(([x, z]) => x === 0 && z === targetZ);
  if (index <= 0) return points;
  return [...points.slice(index), ...points.slice(0, index)];
}

// Builds the actual Cell[] by feeding the computed path through the exact
// same auto-tiling system tile-grid-layer.tsx calls when a person clicks
// to place a tile (placeRoadCell/placeFinishCell from autotile.ts) --
// rather than re-deriving piece-type/rotation logic here, which is how a
// previous version of this generator ended up subtly wrong (a hand-rolled
// orient lookup that didn't match this codebase's actual N/S/E/W
// convention). This guarantees every generated track resolves its pieces
// exactly as if a person had traced this same path in the real editor.
function pointsToCells(points: [number, number][]): Cell[] {
  const grid: Grid = new Map();
  const [startX, startZ] = points[0];
  placeFinishCell(grid, startX, startZ);
  for (let i = 1; i < points.length; i++) {
    placeRoadCell(grid, points[i][0], points[i][1]);
  }
  return gridToCells(grid);
}

function generateOneAttempt(params: DifficultyParams): Cell[] {
  const width = randInt(params.size.min, params.size.max);
  const height = randInt(params.size.min, params.size.max);
  const notchCount = randInt(params.notches.min, params.notches.max);
  const topCount = Math.ceil(notchCount / 2);
  const bottomCount = Math.floor(notchCount / 2);

  const topNotches = pickNotchPositions(width, topCount);
  const bottomNotches = pickNotchPositions(width, bottomCount);
  const waypoints = buildWaypoints(width, height, topNotches, bottomNotches);
  const points = interpolateWaypoints(waypoints);

  if (!isValidLoop(points)) return [];
  return pointsToCells(rotateToSafeFinishStart(points, height));
}

const MAX_ATTEMPTS = 40;

// Generates a random closed-loop track layout tuned toward `targetDifficulty`
// -- retries with fresh random parameters (same tier's size/notch ranges)
// until computeTrackDifficulty actually agrees, since the relationship
// between generation parameters and the resulting score isn't exact.
// Falls back to the last valid attempt if it never converges, rather than
// ever returning nothing.
export function generateDailyTrackLayout(targetDifficulty: Difficulty): {
  cells: Cell[];
  difficulty: Difficulty;
} {
  const params = DIFFICULTY_PARAMS[targetDifficulty];
  let lastValid: Cell[] | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cells = generateOneAttempt(params);
    if (cells.length === 0) continue;
    lastValid = cells;
    if (computeTrackDifficulty(cells) === targetDifficulty) {
      return { cells, difficulty: targetDifficulty };
    }
  }

  // Falls back on the target tier's own parameters, not beginner's -- a
  // caller that asked for expert and hit the retry ceiling should still get
  // an expert-shaped layout, rather than the easiest one in the file.
  const fallback = lastValid ?? generateOneAttempt(params);
  return { cells: fallback, difficulty: computeTrackDifficulty(fallback) };
}

// Generates the daily challenge: a random layout at a random difficulty,
// drawn only from DAILY_CHALLENGE_TIERS.
//
// The tier is a *target*, not a guarantee -- generateDailyTrackLayout
// retries until computeTrackDifficulty agrees, but gives up after
// MAX_ATTEMPTS and returns whatever it last managed, which can score below
// what was asked for. So the result is checked rather than trusted: if the
// first tier lands outside the allowed set, the other one is tried, and
// only if both miss does this settle for the hardest layout either produced.
// Without that check "advanced or expert" would be the intent while a
// beginner track could still occasionally ship.
export function generateRandomDailyTrack(): { cells: Cell[]; difficulty: Difficulty } {
  let best: { cells: Cell[]; difficulty: Difficulty } | null = null;

  for (const tier of shuffled(DAILY_CHALLENGE_TIERS)) {
    const result = generateDailyTrackLayout(tier);
    if (DAILY_CHALLENGE_TIERS.includes(result.difficulty)) return result;
    if (!best || tierRank(result.difficulty) > tierRank(best.difficulty)) best = result;
  }

  return best as { cells: Cell[]; difficulty: Difficulty };
}
