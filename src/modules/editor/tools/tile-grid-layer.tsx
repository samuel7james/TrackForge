"use client";

import { useCallback, useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { CELL_RAW, GRID_SCALE } from "@/modules/game-engine/track";
import {
  cellsToGrid,
  gridToCells,
  placeRoadCell,
  eraseRoadCell,
  placeFinishCell,
} from "@/modules/game-engine/autotile";

const CELL_WORLD_SIZE = CELL_RAW * GRID_SCALE;

// The tile-based editor's road/erase placement. A single invisible ground
// plane click-catcher (only while "tile" or "erase" is active) resolves
// the hit point to a grid cell.
export function TileGridLayer() {
  const cells = useTrackStore((s) => s.document.track.cells);
  const setCells = useTrackStore((s) => s.setCells);

  const activeToolId = useEditorStore((s) => s.activeToolId);

  // A brand-new track (opened with an empty grid) starts with a finish cell,
  // same as the reference editor's own bootstrap ("start with a finish cell
  // if the grid is empty").
  useEffect(() => {
    if (cells.length === 0) {
      setCells(gridToCells(placeFinishCell(new Map(), 0, 0)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();

      if (activeToolId === "tile") {
        const gx = Math.floor(e.point.x / CELL_WORLD_SIZE);
        const gz = Math.floor(e.point.z / CELL_WORLD_SIZE);
        const grid = cellsToGrid(cells);
        placeRoadCell(grid, gx, gz);
        setCells(gridToCells(grid));
        return;
      }

      if (activeToolId === "erase") {
        const gx = Math.floor(e.point.x / CELL_WORLD_SIZE);
        const gz = Math.floor(e.point.z / CELL_WORLD_SIZE);
        const grid = cellsToGrid(cells);
        eraseRoadCell(grid, gx, gz);
        setCells(gridToCells(grid));
      }
    },
    [activeToolId, cells, setCells]
  );

  const showGroundCatcher = activeToolId === "tile" || activeToolId === "erase";

  if (!showGroundCatcher) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleGroundClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
