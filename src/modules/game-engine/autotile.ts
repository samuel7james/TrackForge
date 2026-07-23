// Ported from mrdoob/Starter-Kit-Racing's editor.html (MIT license, inline
// <script> block) -- see public/models/THIRD_PARTY_NOTICES.md. The
// reference keeps this logic and a module-level mutable `grid` Map together
// in one big inline script; here it's pure functions taking the grid
// explicitly, so a React component (tile-grid-layer.tsx) can call it against
// state it owns (a Zustand store) instead of a persistent global.
//
// Auto-tiling: placing a cell doesn't require picking a piece+orientation
// yourself -- resolveNewTile/resolveTile infer straight-vs-corner and
// rotation from which neighbors already have a road, using a 4-bit
// connectivity bitmask (N=8 S=4 E=2 W=1) and a 16-entry lookup table.
import type { Cell, GodotOrient, PieceType } from "./track";

export interface GridCell {
  type: PieceType;
  orient: GodotOrient;
  isFinish: boolean;
  // The reference's own editor.html uses "does this cell have a rendered
  // mesh yet" as its is-this-cell-brand-new flag (resolveCell branches on
  // `!cell.mesh`). This module has no rendering concept at all, so it
  // tracks the same distinction directly: false right after placement
  // (permissive resolveNewTile applies), flipped true the first time
  // resolveCell resolves it (conservative resolveTile applies from then on,
  // so later neighbor changes don't silently break this cell's connections).
  resolved: boolean;
}

export type Grid = Map<string, GridCell>;

export function cellKey(gx: number, gz: number): string {
  return gx + "," + gz;
}

export function cellsToGrid(cells: Cell[]): Grid {
  const grid: Grid = new Map();
  for (const [gx, gz, type, orient] of cells) {
    grid.set(cellKey(gx, gz), { type, orient, isFinish: type === "track-finish", resolved: true });
  }
  return grid;
}

export function gridToCells(grid: Grid): Cell[] {
  const cells: Cell[] = [];
  for (const [key, cell] of grid) {
    const [gx, gz] = key.split(",").map(Number);
    cells.push([gx, gz, cell.type, cell.orient]);
  }
  return cells;
}

const ORIENT_FLIP: Record<GodotOrient, GodotOrient> = { 0: 10, 10: 0, 16: 22, 22: 16 };

// Bitmask: N=8 S=4 E=2 W=1. Corner connectivity: 0°=S+W, 90°=S+E, 180°=N+E, 270°=N+W
const AUTOTILE: Array<[PieceType, GodotOrient]> = [
  ["track-straight", 0], //  0: isolated
  ["track-straight", 16], //  1: W
  ["track-straight", 16], //  2: E
  ["track-straight", 16], //  3: E+W
  ["track-straight", 0], //  4: S
  ["track-corner", 0], //  5: S+W
  ["track-corner", 16], //  6: S+E
  ["track-straight", 16], //  7: S+E+W
  ["track-straight", 0], //  8: N
  ["track-corner", 22], //  9: N+W
  ["track-corner", 10], // 10: N+E
  ["track-straight", 16], // 11: N+E+W
  ["track-straight", 0], // 12: N+S
  ["track-straight", 0], // 13: N+S+W
  ["track-straight", 0], // 14: N+S+E
  ["track-straight", 0], // 15: N+S+E+W
];

// Exit bitmask for each piece type/orient (which sides this piece connects to).
export function getCellExits(cell: { type: PieceType; orient: GodotOrient }): number {
  const { type: t, orient: o } = cell;

  if (t === "track-corner") {
    if (o === 0) return 5; // S+W
    if (o === 16) return 6; // S+E
    if (o === 10) return 10; // N+E
    if (o === 22) return 9; // N+W
  }

  // Straight, finish, bump — all symmetric
  if (o === 0 || o === 10) return 12; // N+S
  return 3; // E+W
}

// Check which neighbors have a road exit facing toward this cell.
export function getConnectivityMask(grid: Grid, gx: number, gz: number): number {
  let mask = 0;

  const n = grid.get(cellKey(gx, gz - 1));
  if (n && getCellExits(n) & 4) mask |= 8;

  const s = grid.get(cellKey(gx, gz + 1));
  if (s && getCellExits(s) & 8) mask |= 4;

  const e = grid.get(cellKey(gx + 1, gz));
  if (e && getCellExits(e) & 1) mask |= 2;

  const w = grid.get(cellKey(gx - 1, gz));
  if (w && getCellExits(w) & 2) mask |= 1;

  return mask;
}

// Raw presence mask (any road in adjacent cell), ignoring exit direction.
export function getPresenceMask(grid: Grid, gx: number, gz: number): number {
  let mask = 0;
  if (grid.has(cellKey(gx, gz - 1))) mask |= 8;
  if (grid.has(cellKey(gx, gz + 1))) mask |= 4;
  if (grid.has(cellKey(gx + 1, gz))) mask |= 2;
  if (grid.has(cellKey(gx - 1, gz))) mask |= 1;
  return mask;
}

function bitCount(mask: number): number {
  return ((mask >> 3) & 1) + ((mask >> 2) & 1) + ((mask >> 1) & 1) + (mask & 1);
}

function connectedExitCount(grid: Grid, gx: number, gz: number): number {
  const cell = grid.get(cellKey(gx, gz));
  if (!cell) return 0;
  return bitCount(getCellExits(cell) & getConnectivityMask(grid, gx, gz));
}

const DIR_INFO = [
  { bit: 8, dx: 0, dz: -1 }, // N
  { bit: 4, dx: 0, dz: 1 }, // S
  { bit: 2, dx: 1, dz: 0 }, // E
  { bit: 1, dx: -1, dz: 0 }, // W
];

// When a new cell has 3+ neighbors, pick the best pair to connect: prefer
// corners over straights, then prefer neighbors with more existing connections.
function pickBestPair(grid: Grid, mask: number, gx: number, gz: number): number {
  const active = DIR_INFO.filter((d) => mask & d.bit);
  if (active.length <= 2) return mask;

  let bestMask = active[0].bit | active[1].bit;
  let bestScore = -1;
  let bestIsCorner = false;

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const pairMask = active[i].bit | active[j].bit;
      const isCorner = pairMask !== 3 && pairMask !== 12; // not E+W or N+S

      const s1 = connectedExitCount(grid, gx + active[i].dx, gz + active[i].dz);
      const s2 = connectedExitCount(grid, gx + active[j].dx, gz + active[j].dz);
      const score = s1 + s2;

      if ((isCorner && !bestIsCorner) || (isCorner === bestIsCorner && score > bestScore)) {
        bestMask = pairMask;
        bestScore = score;
        bestIsCorner = isCorner;
      }
    }
  }

  return bestMask;
}

// Only count neighbors that can actually connect: either they already exit
// toward us, or they have a free (unconnected) exit.
function getAvailableMask(grid: Grid, gx: number, gz: number): number {
  let mask = 0;
  const dirs: Array<[number, number, number, number]> = [
    [0, -1, 8, 4],
    [0, 1, 4, 8],
    [1, 0, 2, 1],
    [-1, 0, 1, 2],
  ];

  for (const [dx, dz, bit, oppBit] of dirs) {
    const neighbor = grid.get(cellKey(gx + dx, gz + dz));
    if (!neighbor) continue;

    const exits = getCellExits(neighbor);

    if (exits & oppBit) {
      mask |= bit;
      continue;
    }

    const conn = getConnectivityMask(grid, gx + dx, gz + dz);
    if (bitCount(exits & conn) < 2) mask |= bit;
  }

  return mask;
}

// Resolve tile for a brand-new cell: use available neighbors, pick best pair if 3+.
export function resolveNewTile(grid: Grid, gx: number, gz: number): [PieceType, GodotOrient] {
  const pMask = getAvailableMask(grid, gx, gz);

  if (bitCount(pMask) >= 3) {
    return AUTOTILE[pickBestPair(grid, pMask, gx, gz)];
  }

  return AUTOTILE[pMask];
}

// Resolve an existing cell after a neighbor changed, without breaking
// connections it already has.
export function resolveTile(grid: Grid, gx: number, gz: number): [PieceType, GodotOrient] {
  const cMask = getConnectivityMask(grid, gx, gz);

  if (cMask !== 0) return AUTOTILE[cMask];

  const pMask = getPresenceMask(grid, gx, gz);
  if (pMask !== 0) {
    const dirs: Array<[number, number, number]> = [
      [0, -1, 8],
      [0, 1, 4],
      [1, 0, 2],
      [-1, 0, 1],
    ];
    for (const [dx, dz, bit] of dirs) {
      if (!(pMask & bit)) continue;
      const neighbor = grid.get(cellKey(gx + dx, gz + dz));
      if (!neighbor) continue;

      const exits = getCellExits(neighbor);
      if (exits & 12) return ["track-straight", 0]; // neighbor runs N-S
      if (exits & 3) return ["track-straight", 16]; // neighbor runs E-W
    }
  }

  return AUTOTILE[0]; // isolated default
}

function resolveCell(grid: Grid, gx: number, gz: number) {
  const key = cellKey(gx, gz);
  const cell = grid.get(key);
  if (!cell) return;

  let baseType: PieceType, orient: GodotOrient;

  if (!cell.resolved) {
    [baseType, orient] = resolveNewTile(grid, gx, gz);
  } else {
    const cMask = getConnectivityMask(grid, gx, gz);
    const currentExits = getCellExits(cell);
    const currentConnected = currentExits & cMask;

    [baseType, orient] = resolveTile(grid, gx, gz);

    const proposedExits = getCellExits({ type: baseType, orient });
    if ((proposedExits & currentConnected) !== currentConnected) return; // would disconnect something
  }

  const type = cell.isFinish && baseType === "track-straight" ? "track-finish" : baseType;
  // Skip only if nothing changed AND this cell has already gone through its
  // first resolve -- a brand-new cell must still "resolve" once even if the
  // computed shape happens to match its placement default, same as the
  // reference (its guard checks `cell.mesh` truthy too, for the same reason).
  if (cell.resolved && cell.type === type && cell.orient === orient) return;

  grid.set(key, { ...cell, type, orient, resolved: true });
}

function resolveCellAndNeighbors(grid: Grid, gx: number, gz: number) {
  resolveCell(grid, gx, gz);
  resolveCell(grid, gx, gz - 1);
  resolveCell(grid, gx, gz + 1);
  resolveCell(grid, gx + 1, gz);
  resolveCell(grid, gx - 1, gz);
}

// Places a road cell (auto-tiling it and its neighbors), or -- if clicking an
// existing finish cell -- flips its direction. Mutates `grid` in place and
// returns it, matching the reference's own imperative style; the caller
// (tile-grid-layer.tsx) is responsible for pushing `gridToCells(grid)` into
// the store afterward.
export function placeRoadCell(grid: Grid, gx: number, gz: number): Grid {
  const key = cellKey(gx, gz);
  const existing = grid.get(key);

  if (existing) {
    if (existing.isFinish) {
      grid.set(key, { ...existing, orient: ORIENT_FLIP[existing.orient] ?? existing.orient });
    }
    return grid;
  }

  grid.set(key, { type: "track-straight", orient: 0, isFinish: false, resolved: false });
  resolveCellAndNeighbors(grid, gx, gz);
  return grid;
}

export function eraseRoadCell(grid: Grid, gx: number, gz: number): Grid {
  const key = cellKey(gx, gz);
  const cell = grid.get(key);
  if (!cell || cell.isFinish) return grid; // can't erase the finish tile

  grid.delete(key);
  resolveCell(grid, gx, gz - 1);
  resolveCell(grid, gx, gz + 1);
  resolveCell(grid, gx + 1, gz);
  resolveCell(grid, gx - 1, gz);
  return grid;
}

export function placeFinishCell(grid: Grid, gx: number, gz: number): Grid {
  grid.set(cellKey(gx, gz), { type: "track-finish", orient: 0, isFinish: true, resolved: true });
  return grid;
}
