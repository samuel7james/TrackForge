"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useTrackStore } from "@/store/track-store";
import { buildTerrainGeometry } from "./terrain-mesh";

// Sculptable ground -- replaces the old static flat plane in SceneRoot.
// Presentational only (like Road), shared unchanged between edit and play
// mode; sculpting/painting interaction lives in the editor-only
// TerrainSculptLayer. DoubleSide because this editor's camera angles don't
// reliably see the ribbon-style winding's front face (confirmed the hard
// way in Phase 11: a FrontSide proxy mesh silently failed to raycast-hit
// despite being geometrically correct).
export function Terrain() {
  const terrain = useTrackStore((s) => s.document.terrain);
  const geometry = useMemo(() => buildTerrainGeometry(terrain), [terrain]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}
