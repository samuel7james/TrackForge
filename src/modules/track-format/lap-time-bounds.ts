// The physical floor under a lap time: how fast a lap on a given track
// could possibly be driven, used server-side to reject submissions that no
// amount of skill could have produced.
//
// Calibrated from real measurements rather than derived from the vehicle
// model -- the car is a rolling sphere driven through an indirect angular
// -velocity target (see vehicle.ts), so there's no clean closed form for
// its speed, the same reason estimate-lap-time.ts is openly a heuristic.
// What was measured:
//
//   * sustained top speed, holding full throttle: ~15-18 world units/sec
//     (p90-p99 of per-frame speed; the raw maximum is meaningless, it
//     catches collision impulses and the fall-off-world respawn teleport)
//   * one grid cell spans 9.99 * 0.75 = 7.49 world units, so flat out in a
//     straight line is roughly 420ms per cell
//   * the fastest lap actually recorded by a human: 329ms per cell
//
// That real lap being quicker than the "straight line" figure is expected
// and is exactly why the floor is set well under it: a racing line cuts
// the inside of corners, so a lap is shorter than cell-count * cell-width
// makes it look. The floor below is a little over a third of the fastest
// real lap -- far enough beneath any human pace to never reject a genuine
// run, far enough above nothing to still catch the impossible. The
// submission that prompted this was 58ms per cell.
const MIN_MS_PER_TRACK_CELL = 120;

/** Cells are [gridX, gridZ, type, orientation]; only the `track-` types are
 * drivable, decoration cells aren't part of the lap. Read structurally
 * rather than through the Zod schema so this stays importable by a route
 * without pulling three.js in behind it. */
function countDrivableCells(document: unknown): number {
  const cells = (document as { track?: { cells?: unknown } } | null)?.track?.cells;
  if (!Array.isArray(cells)) return 0;
  let count = 0;
  for (const cell of cells) {
    if (Array.isArray(cell) && typeof cell[2] === "string" && cell[2].startsWith("track-")) {
      count++;
    }
  }
  return count;
}

/** Null when the track has no drivable cells to reason about -- nothing is
 * asserted rather than guessing a bound out of thin air. */
export function minimumPlausibleLapTimeMs(document: unknown): number | null {
  const cells = countDrivableCells(document);
  if (cells === 0) return null;
  return cells * MIN_MS_PER_TRACK_CELL;
}
