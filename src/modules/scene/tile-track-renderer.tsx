"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useTrackStoreV2 } from "@/store/track-store-v2";
import { computeCellWorldTransform, GRID_SCALE, type Cell, type PieceType } from "@/modules/game-engine/track";

// Editor-only visual for the tile-based track (see mode-controller.tsx --
// Play mode for a v2 document mounts the real vendored engine instead,
// which builds its own track meshes via track.ts's buildTrack; this
// component exists only so the editor has something to look at and click
// on). Reuses computeCellWorldTransform so a piece never drifts from where
// Play would actually render the same cell.
const PIECE_URL: Record<PieceType, string> = {
  "track-straight": "/models/track-straight.glb",
  "track-corner": "/models/track-corner.glb",
  "track-bump": "/models/track-bump.glb",
  "track-finish": "/models/track-finish.glb",
};

function TrackPiece({ cell }: { cell: Cell }) {
  const [gx, gz, type, orient] = cell;
  const { scene } = useGLTF(PIECE_URL[type]);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  const { position, rotationY } = computeCellWorldTransform(gx, gz, orient);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={GRID_SCALE}>
      <primitive object={cloned} />
    </group>
  );
}

export function TileTrackRenderer() {
  const cells = useTrackStoreV2((s) => s.document.track.cells);

  return (
    <>
      {cells.map((cell) => (
        <TrackPiece key={`${cell[0]},${cell[1]}`} cell={cell} />
      ))}
    </>
  );
}

useGLTF.preload(PIECE_URL["track-straight"]);
useGLTF.preload(PIECE_URL["track-corner"]);
useGLTF.preload(PIECE_URL["track-bump"]);
useGLTF.preload(PIECE_URL["track-finish"]);
