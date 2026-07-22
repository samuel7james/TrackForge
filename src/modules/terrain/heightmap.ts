import type { TerrainData, TerrainTextureLayer } from "@/modules/track-format/schema";

export type BrushMode = "raise" | "lower" | "flatten" | "smooth" | "noise";
export type ToolMode = BrushMode | "paint";

export function cellIndex(ix: number, iz: number, resolution: number): number {
  return ix + iz * resolution;
}

// World-space (x,z) -> fractional grid coordinates. Fractional (not rounded)
// so brush falloff math can treat the cursor as a continuous point rather
// than snapping to the nearest vertex.
export function worldToGrid(x: number, z: number, terrain: TerrainData): { gx: number; gz: number } {
  const { width, depth } = terrain.size;
  const gx = ((x + width / 2) / width) * (terrain.resolution - 1);
  const gz = ((z + depth / 2) / depth) * (terrain.resolution - 1);
  return { gx, gz };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Bilinear height at an arbitrary world (x,z) -- used by track validation to
// check the terrain lines up with the road surface, not just at grid
// vertices (used by TrackPhysics et al., which need per-vertex data anyway).
export function sampleTerrainHeight(terrain: TerrainData, x: number, z: number): number {
  const { gx, gz } = worldToGrid(x, z, terrain);
  const ix0 = Math.max(0, Math.min(terrain.resolution - 2, Math.floor(gx)));
  const iz0 = Math.max(0, Math.min(terrain.resolution - 2, Math.floor(gz)));
  const tx = Math.min(1, Math.max(0, gx - ix0));
  const tz = Math.min(1, Math.max(0, gz - iz0));

  const h00 = terrain.heightmap[cellIndex(ix0, iz0, terrain.resolution)];
  const h10 = terrain.heightmap[cellIndex(ix0 + 1, iz0, terrain.resolution)];
  const h01 = terrain.heightmap[cellIndex(ix0, iz0 + 1, terrain.resolution)];
  const h11 = terrain.heightmap[cellIndex(ix0 + 1, iz0 + 1, terrain.resolution)];

  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function forEachCellInRadius(
  resolution: number,
  centerX: number,
  centerZ: number,
  radiusCells: number,
  visit: (ix: number, iz: number, falloff: number) => void
) {
  const minIx = Math.max(0, Math.floor(centerX - radiusCells));
  const maxIx = Math.min(resolution - 1, Math.ceil(centerX + radiusCells));
  const minIz = Math.max(0, Math.floor(centerZ - radiusCells));
  const maxIz = Math.min(resolution - 1, Math.ceil(centerZ + radiusCells));

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
      const dist = Math.hypot(ix - centerX, iz - centerZ);
      if (dist > radiusCells) continue;
      visit(ix, iz, 1 - smoothstep(0, radiusCells, dist));
    }
  }
}

function averageNeighbors(heightmap: number[], resolution: number, ix: number, iz: number): number {
  let sum = 0;
  let count = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = ix + dx;
      const nz = iz + dz;
      if (nx < 0 || nx >= resolution || nz < 0 || nz >= resolution) continue;
      sum += heightmap[cellIndex(nx, nz, resolution)];
      count += 1;
    }
  }
  return count > 0 ? sum / count : heightmap[cellIndex(ix, iz, resolution)];
}

// Applies one brush "dab" centered at (fractional) grid coordinates,
// returning a new heightmap (the caller owns undo -- see
// TerrainSculptCommand, which snapshots the whole array before/after a
// stroke rather than diffing individual cells).
export function applyBrush(
  heightmap: number[],
  resolution: number,
  centerX: number,
  centerZ: number,
  radiusCells: number,
  strength: number,
  mode: BrushMode
): number[] {
  const next = heightmap.slice();
  forEachCellInRadius(resolution, centerX, centerZ, radiusCells, (ix, iz, falloff) => {
    const idx = cellIndex(ix, iz, resolution);
    const current = next[idx];
    if (mode === "raise") next[idx] = current + strength * falloff;
    else if (mode === "lower") next[idx] = current - strength * falloff;
    else if (mode === "flatten") next[idx] = current * (1 - falloff * strength);
    else if (mode === "smooth") {
      const avg = averageNeighbors(heightmap, resolution, ix, iz);
      next[idx] = current + (avg - current) * falloff * strength;
    } else if (mode === "noise") {
      next[idx] = current + (Math.random() * 2 - 1) * strength * falloff;
    }
  });
  return next;
}

// Raises the target layer's weight within the brush radius and renormalizes
// every layer at each touched vertex back to summing to 1 -- the standard
// splat-map painting technique, so "painting dirt" visibly displaces grass
// rather than just adding an independent, unbounded dirt value.
export function applyPaint(
  textureLayers: TerrainTextureLayer[],
  resolution: number,
  centerX: number,
  centerZ: number,
  radiusCells: number,
  strength: number,
  targetType: TerrainTextureLayer["type"]
): TerrainTextureLayer[] {
  const next = textureLayers.map((layer) => ({ ...layer, weightmap: layer.weightmap.slice() }));
  const targetIndex = next.findIndex((layer) => layer.type === targetType);
  if (targetIndex === -1) return textureLayers;

  forEachCellInRadius(resolution, centerX, centerZ, radiusCells, (ix, iz, falloff) => {
    const idx = cellIndex(ix, iz, resolution);
    next[targetIndex].weightmap[idx] = Math.min(1, next[targetIndex].weightmap[idx] + strength * falloff);
    const total = next.reduce((sum, layer) => sum + layer.weightmap[idx], 0) || 1;
    for (const layer of next) {
      layer.weightmap[idx] = layer.weightmap[idx] / total;
    }
  });
  return next;
}
