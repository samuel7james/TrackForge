import type { Cell, PieceType } from "@/modules/game-engine/track";
import { computeTrackDifficulty } from "./auto-difficulty";
import type { Difficulty } from "./schema";

export const DIFFICULTY_TIERS: Difficulty[] = ["beginner", "intermediate", "advanced", "expert"];

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

function pickRandomTier(): Difficulty {
  return DIFFICULTY_TIERS[randInt(0, DIFFICULTY_TIERS.length - 1)];
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

function turnSign(a: [number, number], b: [number, number], c: [number, number]): 0 | 1 | -1 {
  const inX = Math.sign(b[0] - a[0]);
  const inZ = Math.sign(b[1] - a[1]);
  const outX = Math.sign(c[0] - b[0]);
  const outZ = Math.sign(c[1] - b[1]);
  const cross = inX * outZ - inZ * outX;
  if (cross > 0) return 1;
  if (cross < 0) return -1;
  return 0;
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

function pointsToCells(points: [number, number][]): Cell[] {
  const n = points.length;
  return points.map(([gx, gz], i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const sign = turnSign(prev, [gx, gz], next);
    const type: PieceType = i === 0 ? "track-finish" : sign === 0 ? "track-straight" : "track-corner";
    return [gx, gz, type, 0] as Cell;
  });
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
  return pointsToCells(points);
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

  const fallback = lastValid ?? generateOneAttempt(DIFFICULTY_PARAMS.beginner);
  return { cells: fallback, difficulty: computeTrackDifficulty(fallback) };
}

// Picks a difficulty tier uniformly at random, then generates a layout
// tuned toward it -- "random layout, random difficulty" for the daily
// challenge, per the explicit request that generated this feature.
export function generateRandomDailyTrack(): { cells: Cell[]; difficulty: Difficulty } {
  return generateDailyTrackLayout(pickRandomTier());
}
