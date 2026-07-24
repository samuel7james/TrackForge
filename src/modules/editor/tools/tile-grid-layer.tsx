"use client";

import { useCallback, useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { usePropPaletteStore } from "@/store/prop-palette-store";
import { createPlacedObject } from "@/modules/objects/prop-registry";
import { usePresenceContext } from "@/modules/editor/collab/presence-context";
import { CELL_RAW, GRID_SCALE } from "@/modules/game-engine/track";
import {
  cellsToGrid,
  gridToCells,
  placeRoadCell,
  eraseRoadCell,
  placeFinishCell,
} from "@/modules/game-engine/autotile";

const CELL_WORLD_SIZE = CELL_RAW * GRID_SCALE;

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

// The tile-based editor's road/erase/object placement. A single invisible
// ground plane click-catcher (only while one of "tile" / "erase" / "object"
// is active) does everything: click resolves the hit point to a grid cell
// (tile tools) or a raw world position (object tool).
//
// Deliberately simple for this pass: places/selects/deletes objects
// directly against the store, with no undo/redo command wrapping yet --
// drag-to-reposition and undo/redo for placed objects in this editor are
// left as a follow-up, not silently dropped.
export function TileGridLayer() {
  const cells = useTrackStore((s) => s.document.track.cells);
  const setCells = useTrackStore((s) => s.setCells);
  const objects = useTrackStore((s) => s.document.objects);
  const insertPlacedObject = useTrackStore((s) => s.insertPlacedObject);
  const removePlacedObjectById = useTrackStore((s) => s.removePlacedObjectById);

  const activeToolId = useEditorStore((s) => s.activeToolId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const selectedPropType = usePropPaletteStore((s) => s.selectedType);
  const { broadcastCursor } = usePresenceContext();

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
        return;
      }

      if (activeToolId === "object") {
        const object = createPlacedObject(selectedPropType, { x: e.point.x, y: 0, z: e.point.z });
        insertPlacedObject(object);
        setSelectedId(object.id);
      }
    },
    [activeToolId, cells, setCells, selectedPropType, insertPlacedObject, setSelectedId]
  );

  const handleGroundPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      broadcastCursor(e.point.x, e.point.z);
    },
    [broadcastCursor]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingIntoField(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const object = objects.find((o) => o.id === selectedId);
        if (object) {
          removePlacedObjectById(object.id);
          setSelectedId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, objects, removePlacedObjectById, setSelectedId]);

  const showGroundCatcher = activeToolId === "tile" || activeToolId === "erase" || activeToolId === "object";

  return (
    <>
      {showGroundCatcher && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleGroundClick}
          onPointerMove={handleGroundPointerMove}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {objects.map((object) => (
        <mesh
          key={object.id}
          position={[object.position.x, object.position.y + 0.6, object.position.z]}
          onPointerDown={(e) => {
            e.stopPropagation();
            setSelectedId(object.id);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <sphereGeometry args={[0.6, 12, 12]} />
          <meshStandardMaterial
            color="#f2c94c"
            transparent
            opacity={selectedId === object.id ? 0.35 : 0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
