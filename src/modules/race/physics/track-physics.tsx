"use client";

import { useMemo } from "react";
import { RigidBody, HeightfieldCollider, TrimeshCollider } from "@react-three/rapier";
import { useTrackStore } from "@/store/track-store";
import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import { buildRoadGeometry } from "@/modules/spline/road-mesh";
import { terrainHeightsForCollider } from "@/modules/terrain/terrain-mesh";
import type { RoadSpline, TerrainData } from "@/modules/track-format/schema";

// Same index(ix,iz) = ix + iz*resolution convention as terrain-mesh.ts's
// visual geometry -- which is exactly Rapier's column-major heights matrix
// layout for an (nrows+1) x (ncols+1) grid, so the collider needs no
// transformation to line up with what's rendered.
function TerrainCollider({ terrain }: { terrain: TerrainData }) {
  const heights = useMemo(() => terrainHeightsForCollider(terrain), [terrain]);
  const cellCount = terrain.resolution - 1;

  return (
    <RigidBody type="fixed">
      <HeightfieldCollider
        args={[cellCount, cellCount, Array.from(heights), { x: terrain.size.width, y: 1, z: terrain.size.depth }]}
      />
    </RigidBody>
  );
}

function RoadCollider({ spline }: { spline: RoadSpline }) {
  const meshData = useMemo(() => {
    const samples = sampleRoadCenterline(spline.points, spline.closed);
    const geometry = buildRoadGeometry(samples);
    const position = geometry.attributes.position?.array as Float32Array | undefined;
    const index = geometry.index?.array as Uint16Array | Uint32Array | undefined;
    if (!position || !index || position.length === 0) return null;
    return { vertices: position, indices: Uint32Array.from(index) };
  }, [spline]);

  if (!meshData) return null;

  return (
    <RigidBody type="fixed">
      <TrimeshCollider args={[meshData.vertices, meshData.indices]} />
    </RigidBody>
  );
}

// Static colliders only — reuses the same spline/terrain -> geometry
// pipelines the visual Road and Terrain components use (PROJECT_PLAN.md §4),
// so the driveable surface always matches what was edited (Phase 12: this
// replaced a flat CuboidCollider ground with a real HeightfieldCollider, so
// sculpted hills are now something the car actually drives over rather than
// a flat floor underneath them). Explicit collider components rather than
// mesh-based `colliders="cuboid"/"trimesh"` auto-fit — the auto-fit path
// silently produced no collider at all when the reference mesh was
// `visible={false}` (verified while debugging: the car fell through both
// the ground and the road with no error, an empty world position log).
export function TrackPhysics() {
  const splines = useTrackStore((s) => s.document.splines);
  const terrain = useTrackStore((s) => s.document.terrain);

  return (
    <>
      <TerrainCollider terrain={terrain} />

      {splines.map((spline) => (
        <RoadCollider key={spline.id} spline={spline} />
      ))}
    </>
  );
}
