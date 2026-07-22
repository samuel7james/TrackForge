"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { AddControlPointCommand } from "@/modules/editor/commands/add-control-point-command";
import { RemoveControlPointCommand } from "@/modules/editor/commands/remove-control-point-command";
import { UpdateControlPointCommand } from "@/modules/editor/commands/update-control-point-command";
import { createControlPoint, type RoadControlPoint, type Vec3 } from "@/modules/track-format/schema";
import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import { buildRoadGeometry } from "@/modules/spline/road-mesh";

const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const EMPTY_POINTS: RoadControlPoint[] = [];

const GRID_SIZE = 2; // matches SceneRoot's <Grid cellSize={2}>
const POINT_SNAP_RADIUS = 1.5;
const ANGLE_SNAP_STEP = THREE.MathUtils.degToRad(15);
// Nudges the invisible split-segment click-catcher above the visible road
// surface so it's the closer raycast hit for any camera looking down at the
// track (true for every camera mode this editor has) -- otherwise a click
// could resolve against the ground plane underneath instead.
const SPLIT_PROXY_HEIGHT = 0.08;

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Point-snap (always on, within a small radius) takes priority over grid-snap
// (held modifier) -- landing exactly on an existing point matters more for a
// closed loop than landing on a grid line, and a point that's already near
// the grid will usually also round to it anyway.
function applyPositionSnapping(
  raw: Vec3,
  points: RoadControlPoint[],
  excludeId: string | null,
  gridSnapHeld: boolean
): Vec3 {
  for (const p of points) {
    if (p.id === excludeId) continue;
    const dx = p.position.x - raw.x;
    const dz = p.position.z - raw.z;
    if (Math.sqrt(dx * dx + dz * dz) <= POINT_SNAP_RADIUS) {
      return { x: p.position.x, y: raw.y, z: p.position.z };
    }
  }
  if (gridSnapHeld) {
    return { x: snapToGrid(raw.x), y: raw.y, z: snapToGrid(raw.z) };
  }
  return raw;
}

// Constrains a new point's direction from the previous point to the nearest
// 15° increment, keeping the click's original distance -- the standard
// shift-to-constrain-angle convention from vector drawing tools.
function applyAngleSnapping(raw: Vec3, from: Vec3): Vec3 {
  const dx = raw.x - from.x;
  const dz = raw.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 1e-6) return raw;
  const angle = Math.atan2(dz, dx);
  const snappedAngle = Math.round(angle / ANGLE_SNAP_STEP) * ANGLE_SNAP_STEP;
  return {
    x: from.x + Math.cos(snappedAngle) * dist,
    y: raw.y,
    z: from.z + Math.sin(snappedAngle) * dist,
  };
}

// The Road Tool's and Select Tool's shared behavior: both can select, drag,
// and delete control points. Only the Road Tool adds new ones on ground
// click; the Select Tool can split a segment by clicking directly on the
// road surface instead. All mutations go through the CommandStack for
// undo/redo, except during an active drag — those apply directly for live
// feedback, and a single UpdateControlPointCommand commits the whole
// gesture on release.
export function PointEditingLayer() {
  const spline = useTrackStore((s) => s.document.splines[0]);
  const points = spline?.points ?? EMPTY_POINTS;
  const closed = spline?.closed ?? false;
  const patchControlPoint = useTrackStore((s) => s.patchControlPoint);

  const activeToolId = useEditorStore((s) => s.activeToolId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const setIsDraggingControlPoint = useEditorStore((s) => s.setIsDraggingControlPoint);

  const execute = useCommandStack((s) => s.execute);

  const draggingPointId = useRef<string | null>(null);
  const dragStartPosition = useRef<Vec3 | null>(null);

  const splitProxyGeometry = useMemo(() => {
    if (points.length < 2) return null;
    const samples = sampleRoadCenterline(points, closed);
    return { geometry: buildRoadGeometry(samples), samples };
  }, [points, closed]);

  const handleGroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (activeToolId !== "road") {
        setSelectedId(null);
        return;
      }
      let position: Vec3 = { x: e.point.x, y: 0, z: e.point.z };
      const previous = points[points.length - 1];
      if (e.shiftKey && previous) {
        position = applyAngleSnapping(position, previous.position);
      }
      position = applyPositionSnapping(position, points, null, e.ctrlKey || e.metaKey);
      execute(new AddControlPointCommand(createControlPoint(position)));
    },
    [activeToolId, points, execute, setSelectedId]
  );

  // Select Tool only: clicking the road surface itself inserts a new point
  // at the nearest spot on the centerline instead of deselecting.
  const handleRoadSurfaceClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (activeToolId !== "select" || !splitProxyGeometry) return;
      e.stopPropagation();
      const { samples } = splitProxyGeometry;
      let nearestIndex = 0;
      let nearestDistSq = Infinity;
      samples.forEach((sample, i) => {
        const distSq = sample.position.distanceToSquared(e.point);
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearestIndex = i;
        }
      });
      const sample = samples[nearestIndex];
      const segmentCount = closed ? points.length : points.length - 1;
      const u = nearestIndex / (samples.length - 1);
      const segmentIndex = Math.min(Math.floor(u * segmentCount), segmentCount - 1);

      const newPoint = createControlPoint({
        x: sample.position.x,
        y: sample.position.y,
        z: sample.position.z,
      });
      newPoint.width = sample.width;
      execute(new AddControlPointCommand(newPoint, segmentIndex + 1));
      setSelectedId(newPoint.id);
    },
    [activeToolId, splitProxyGeometry, closed, points, execute, setSelectedId]
  );

  const handlePointPointerDown = useCallback(
    (pointId: string, position: Vec3) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      draggingPointId.current = pointId;
      dragStartPosition.current = position;
      setSelectedId(pointId);
      setIsDraggingControlPoint(true);
      dragPlane.setFromNormalAndCoplanarPoint(
        UP,
        new THREE.Vector3(position.x, position.y, position.z)
      );
    },
    [setSelectedId, setIsDraggingControlPoint]
  );

  const handlePointPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const pointId = draggingPointId.current;
      if (!pointId) return;
      e.stopPropagation();
      if (e.ray.intersectPlane(dragPlane, dragPoint)) {
        const snapped = applyPositionSnapping(
          { x: dragPoint.x, y: dragPoint.y, z: dragPoint.z },
          points,
          pointId,
          e.ctrlKey || e.metaKey
        );
        patchControlPoint(pointId, { position: snapped });
      }
    },
    [patchControlPoint, points]
  );

  const endDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const pointId = draggingPointId.current;
      const from = dragStartPosition.current;
      draggingPointId.current = null;
      dragStartPosition.current = null;
      if (!pointId || !from) return;
      e.stopPropagation();
      setIsDraggingControlPoint(false);

      const point = useTrackStore
        .getState()
        .document.splines[0]?.points.find((p) => p.id === pointId);
      if (!point) return;
      const to = point.position;
      if (to.x !== from.x || to.y !== from.y || to.z !== from.z) {
        execute(
          new UpdateControlPointCommand(pointId, { position: from }, { position: to })
        );
      }
    },
    [execute, setIsDraggingControlPoint]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingIntoField(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const index = points.findIndex((p) => p.id === selectedId);
        const point = points[index];
        if (point) {
          execute(new RemoveControlPointCommand(point, index));
          setSelectedId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, points, execute, setSelectedId]);

  return (
    <>
      {/* Invisible-but-raycastable click target for appending new points --
          only for Road/Select: skipped in Terrain so it can't shadow
          TerrainSculptLayer's own raycast target in a sculpted valley (this
          plane is always at y=0, which would sit above lowered terrain),
          and skipped in Object so it doesn't fight ObjectPlacementLayer's
          own ground-click-catcher for the same coincident plane. */}
      {(activeToolId === "road" || activeToolId === "select") && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleGroundClick}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {splitProxyGeometry && activeToolId === "select" && (
        <mesh
          position={[0, SPLIT_PROXY_HEIGHT, 0]}
          geometry={splitProxyGeometry.geometry}
          onClick={handleRoadSurfaceClick}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* DoubleSide -- matches Road's own material (road.tsx); the
              ribbon's winding order isn't reliably front-facing toward this
              editor's camera angles, so a FrontSide (default) material here
              would silently fail to raycast-hit despite the mesh being in
              the right place (confirmed while debugging: zero hits at any
              pixel visually on the ribbon until this was added). */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {points.map((point) => (
        <mesh
          key={point.id}
          position={[point.position.x, point.position.y + 0.05, point.position.z]}
          onPointerDown={handlePointPointerDown(point.id, point.position)}
          onPointerMove={handlePointPointerMove}
          onPointerUp={endDrag}
          onClick={(e) => e.stopPropagation()}
        >
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial
            color={selectedId === point.id ? "#f2c94c" : "#5b8cff"}
            emissive={selectedId === point.id ? "#f2c94c" : "#000000"}
            emissiveIntensity={selectedId === point.id ? 0.4 : 0}
          />
        </mesh>
      ))}
    </>
  );
}
