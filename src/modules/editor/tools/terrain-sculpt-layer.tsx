"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useTerrainBrushStore } from "@/store/terrain-brush-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { TerrainSculptCommand, type TerrainSnapshot } from "@/modules/editor/commands/terrain-sculpt-command";
import { buildTerrainGeometry } from "@/modules/terrain/terrain-mesh";
import { applyBrush, applyPaint, worldToGrid } from "@/modules/terrain/heightmap";

// An invisible copy of the terrain surface, raycastable only while the
// Terrain tool is active, so sculpting/painting never has to touch the
// presentational Terrain component shared with Play mode (same separation
// PointEditingLayer keeps from Road). DoubleSide for the same reason as the
// split-segment proxy in Phase 11 -- a FrontSide-default material silently
// stops registering raycast hits from this editor's camera angles.
export function TerrainSculptLayer() {
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const setIsDraggingControlPoint = useEditorStore((s) => s.setIsDraggingControlPoint);
  const setSelectedPointId = useEditorStore((s) => s.setSelectedPointId);
  const terrain = useTrackStore((s) => s.document.terrain);
  const setHeightmap = useTrackStore((s) => s.setTerrainHeightmap);
  const setTextureLayers = useTrackStore((s) => s.setTerrainTextureLayers);
  const execute = useCommandStack((s) => s.execute);

  const mode = useTerrainBrushStore((s) => s.mode);
  const radiusCells = useTerrainBrushStore((s) => s.radiusCells);
  const strength = useTerrainBrushStore((s) => s.strength);
  const paintLayer = useTerrainBrushStore((s) => s.paintLayer);

  const proxyGeometry = useMemo(() => buildTerrainGeometry(terrain), [terrain]);
  const isDragging = useRef(false);
  const strokeStart = useRef<TerrainSnapshot | null>(null);

  const applyAt = useCallback(
    (point: THREE.Vector3) => {
      const { document } = useTrackStore.getState();
      const current = document.terrain;
      const { gx, gz } = worldToGrid(point.x, point.z, current);
      if (mode === "paint") {
        setTextureLayers(
          applyPaint(current.textureLayers, current.resolution, gx, gz, radiusCells, strength, paintLayer)
        );
      } else {
        setHeightmap(applyBrush(current.heightmap, current.resolution, gx, gz, radiusCells, strength, mode));
      }
    },
    [mode, radiusCells, strength, paintLayer, setHeightmap, setTextureLayers]
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      isDragging.current = true;
      setIsDraggingControlPoint(true);
      const { terrain: t } = useTrackStore.getState().document;
      strokeStart.current = { heightmap: t.heightmap, textureLayers: t.textureLayers };
      applyAt(e.point);
    },
    [applyAt, setIsDraggingControlPoint]
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDragging.current) return;
      e.stopPropagation();
      applyAt(e.point);
    },
    [applyAt]
  );

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDragging.current) return;
      e.stopPropagation();
      isDragging.current = false;
      setIsDraggingControlPoint(false);
      const before = strokeStart.current;
      strokeStart.current = null;
      if (!before) return;
      const { terrain: after } = useTrackStore.getState().document;
      if (before.heightmap !== after.heightmap || before.textureLayers !== after.textureLayers) {
        execute(
          new TerrainSculptCommand(before, { heightmap: after.heightmap, textureLayers: after.textureLayers })
        );
      }
    },
    [execute, setIsDraggingControlPoint]
  );

  // Clears any lingering point selection so InspectorPanel doesn't render
  // on top of TerrainBrushPanel in the same corner while sculpting.
  useEffect(() => {
    if (activeToolId === "terrain") setSelectedPointId(null);
  }, [activeToolId, setSelectedPointId]);

  if (activeToolId !== "terrain") return null;

  return (
    <mesh
      geometry={proxyGeometry}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
