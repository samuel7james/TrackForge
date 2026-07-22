"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { RoadSpline } from "@/modules/track-format/schema";
import { sampleRoadCenterline } from "./catmull-rom";
import { buildCurbGeometry, buildRoadGeometry } from "./road-mesh";

export function Road({ spline }: { spline: RoadSpline }) {
  const { roadGeometry, curbGeometry } = useMemo(() => {
    const samples = sampleRoadCenterline(spline.points, spline.closed);
    return {
      roadGeometry: buildRoadGeometry(samples),
      curbGeometry: buildCurbGeometry(samples),
    };
  }, [spline]);

  if (spline.points.length < 2) return null;

  return (
    <group>
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial color="#2b2d33" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={curbGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
