"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import type { RoadControlPoint } from "@/modules/track-format/schema";

const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Stable reference so the trackStore selector below never returns a
// fresh array on every call — a fresh `[]` literal fails Zustand's
// reference-equality check every time and causes an infinite render loop.
const EMPTY_POINTS: RoadControlPoint[] = [];

// Direct interaction with the active spline's control points: click empty
// ground to append a point, drag a point to move it, select + Delete/Backspace
// to remove it. This is the Road Tool's behavior; it mutates trackStore
// directly for now. Phase 4 wraps these same mutations in Commands for
// undo/redo and formalizes this into the EditorTool plugin interface.
export function RoadEditingLayer() {
  const points = useTrackStore((s) => s.document.splines[0]?.points ?? EMPTY_POINTS);
  const addControlPoint = useTrackStore((s) => s.addControlPoint);
  const moveControlPoint = useTrackStore((s) => s.moveControlPoint);
  const removeControlPoint = useTrackStore((s) => s.removeControlPoint);

  const selectedPointId = useEditorStore((s) => s.selectedPointId);
  const setSelectedPointId = useEditorStore((s) => s.setSelectedPointId);
  const setIsDraggingControlPoint = useEditorStore(
    (s) => s.setIsDraggingControlPoint
  );

  const draggingPointId = useRef<string | null>(null);

  const handleGroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      addControlPoint({ x: e.point.x, y: 0, z: e.point.z });
    },
    [addControlPoint]
  );

  const handlePointPointerDown = useCallback(
    (pointId: string, position: THREE.Vector3) =>
      (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        draggingPointId.current = pointId;
        setSelectedPointId(pointId);
        setIsDraggingControlPoint(true);
        dragPlane.setFromNormalAndCoplanarPoint(UP, position);
      },
    [setSelectedPointId, setIsDraggingControlPoint]
  );

  const handlePointPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const pointId = draggingPointId.current;
      if (!pointId) return;
      e.stopPropagation();
      if (e.ray.intersectPlane(dragPlane, dragPoint)) {
        moveControlPoint(pointId, {
          x: dragPoint.x,
          y: dragPoint.y,
          z: dragPoint.z,
        });
      }
    },
    [moveControlPoint]
  );

  const endDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!draggingPointId.current) return;
      e.stopPropagation();
      draggingPointId.current = null;
      setIsDraggingControlPoint(false);
    },
    [setIsDraggingControlPoint]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedPointId) {
        removeControlPoint(selectedPointId);
        setSelectedPointId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPointId, removeControlPoint, setSelectedPointId]);

  return (
    <>
      {/* Invisible-but-raycastable click target for appending new points. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleGroundClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {points.map((point) => (
        <mesh
          key={point.id}
          position={[point.position.x, point.position.y + 0.05, point.position.z]}
          onPointerDown={handlePointPointerDown(
            point.id,
            new THREE.Vector3(point.position.x, point.position.y, point.position.z)
          )}
          onPointerMove={handlePointPointerMove}
          onPointerUp={endDrag}
          onClick={(e) => e.stopPropagation()}
        >
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial
            color={selectedPointId === point.id ? "#f2c94c" : "#5b8cff"}
            emissive={selectedPointId === point.id ? "#f2c94c" : "#000000"}
            emissiveIntensity={selectedPointId === point.id ? 0.4 : 0}
          />
        </mesh>
      ))}
    </>
  );
}
