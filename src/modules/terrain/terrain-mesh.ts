import * as THREE from "three";
import type { TerrainData } from "@/modules/track-format/schema";
import { cellIndex } from "./heightmap";

const GRASS_COLOR = new THREE.Color("#3d4a35");
const DIRT_COLOR = new THREE.Color("#4a3b2c");
const ROCK_COLOR = new THREE.Color("#55565c");

// Vertex-colored heightfield grid -- same manual BufferGeometry-construction
// approach as road-mesh.ts's ribbon (rather than THREE.PlaneGeometry +
// mutating its position attribute) so vertex order is fully under our
// control and matches TrackPhysics's HeightfieldCollider index-for-index
// (Rapier's heights matrix is column-major: index = ix + iz*resolution,
// which this uses directly).
export function buildTerrainGeometry(terrain: TerrainData): THREE.BufferGeometry {
  const { resolution, size, heightmap, textureLayers } = terrain;
  const grass = textureLayers.find((l) => l.type === "grass")?.weightmap;
  const dirt = textureLayers.find((l) => l.type === "dirt")?.weightmap;
  const rock = textureLayers.find((l) => l.type === "rock")?.weightmap;

  const positions = new Float32Array(resolution * resolution * 3);
  const colors = new Float32Array(resolution * resolution * 3);

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const idx = cellIndex(ix, iz, resolution);
      const x = (ix / (resolution - 1)) * size.width - size.width / 2;
      const z = (iz / (resolution - 1)) * size.depth - size.depth / 2;
      const y = heightmap[idx] ?? 0;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      const wG = grass?.[idx] ?? 1;
      const wD = dirt?.[idx] ?? 0;
      const wR = rock?.[idx] ?? 0;
      const total = wG + wD + wR || 1;
      colors[idx * 3] = (GRASS_COLOR.r * wG + DIRT_COLOR.r * wD + ROCK_COLOR.r * wR) / total;
      colors[idx * 3 + 1] = (GRASS_COLOR.g * wG + DIRT_COLOR.g * wD + ROCK_COLOR.g * wR) / total;
      colors[idx * 3 + 2] = (GRASS_COLOR.b * wG + DIRT_COLOR.b * wD + ROCK_COLOR.b * wR) / total;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < resolution - 1; iz++) {
    for (let ix = 0; ix < resolution - 1; ix++) {
      const a = cellIndex(ix, iz, resolution);
      const b = cellIndex(ix + 1, iz, resolution);
      const c = cellIndex(ix, iz + 1, resolution);
      const d = cellIndex(ix + 1, iz + 1, resolution);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Flat array of raw heights for Rapier's HeightfieldCollider -- same
// index(ix,iz) = ix + iz*resolution convention as the geometry above, which
// is exactly Rapier's column-major heights matrix layout, so no
// transformation is needed between the visual mesh and the collider.
export function terrainHeightsForCollider(terrain: TerrainData): Float32Array {
  return Float32Array.from(terrain.heightmap);
}
