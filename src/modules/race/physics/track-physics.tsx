"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider, TrimeshCollider } from "@react-three/rapier";
import { useTrackStore } from "@/store/track-store";
import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import { buildRoadGeometry } from "@/modules/spline/road-mesh";
import type { RoadSpline } from "@/modules/track-format/schema";

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

// Static colliders only — reuses the same spline -> geometry pipeline the
// visual Road component uses (PROJECT_PLAN.md §4), so the driveable surface
// always matches what was edited. A flat ground collider catches the car if
// it drives off the track. Explicit collider components rather than
// mesh-based `colliders="cuboid"/"trimesh"` auto-fit — the auto-fit path
// silently produced no collider at all when the reference mesh was
// `visible={false}` (verified while debugging: the car fell through both
// the ground and the road with no error, an empty world position log).
export function TrackPhysics() {
  const splines = useTrackStore((s) => s.document.splines);

  return (
    <>
      <RigidBody type="fixed" position={[0, -0.5, 0]}>
        <CuboidCollider args={[250, 0.5, 250]} />
      </RigidBody>

      {splines.map((spline) => (
        <RoadCollider key={spline.id} spline={spline} />
      ))}
    </>
  );
}
