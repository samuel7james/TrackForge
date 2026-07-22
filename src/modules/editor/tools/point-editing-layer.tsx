"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { AddControlPointCommand } from "@/modules/editor/commands/add-control-point-command";
import { RemoveControlPointCommand } from "@/modules/editor/commands/remove-control-point-command";
import { UpdateControlPointCommand } from "@/modules/editor/commands/update-control-point-command";
import { createControlPoint, type RoadControlPoint, type Vec3 } from "@/modules/track-format/schema";

const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const EMPTY_POINTS: RoadControlPoint[] = [];

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

// The Road Tool's and Select Tool's shared behavior: both can select, drag,
// and delete control points. Only the Road Tool adds new ones on ground
// click. All mutations go through the CommandStack for undo/redo, except
// during an active drag — those apply directly for live feedback, and a
// single UpdateControlPointCommand commits the whole gesture on release.
export function PointEditingLayer() {
  const points = useTrackStore((s) => s.document.splines[0]?.points ?? EMPTY_POINTS);
  const patchControlPoint = useTrackStore((s) => s.patchControlPoint);

  const activeToolId = useEditorStore((s) => s.activeToolId);
  const selectedPointId = useEditorStore((s) => s.selectedPointId);
  const setSelectedPointId = useEditorStore((s) => s.setSelectedPointId);
  const setIsDraggingControlPoint = useEditorStore((s) => s.setIsDraggingControlPoint);

  const execute = useCommandStack((s) => s.execute);

  const draggingPointId = useRef<string | null>(null);
  const dragStartPosition = useRef<Vec3 | null>(null);

  const handleGroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (activeToolId === "road") {
        execute(new AddControlPointCommand(createControlPoint({ x: e.point.x, y: 0, z: e.point.z })));
      } else {
        setSelectedPointId(null);
      }
    },
    [activeToolId, execute, setSelectedPointId]
  );

  const handlePointPointerDown = useCallback(
    (pointId: string, position: Vec3) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      draggingPointId.current = pointId;
      dragStartPosition.current = position;
      setSelectedPointId(pointId);
      setIsDraggingControlPoint(true);
      dragPlane.setFromNormalAndCoplanarPoint(
        UP,
        new THREE.Vector3(position.x, position.y, position.z)
      );
    },
    [setSelectedPointId, setIsDraggingControlPoint]
  );

  const handlePointPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const pointId = draggingPointId.current;
      if (!pointId) return;
      e.stopPropagation();
      if (e.ray.intersectPlane(dragPlane, dragPoint)) {
        patchControlPoint(pointId, {
          position: { x: dragPoint.x, y: dragPoint.y, z: dragPoint.z },
        });
      }
    },
    [patchControlPoint]
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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedPointId) {
        const index = points.findIndex((p) => p.id === selectedPointId);
        const point = points[index];
        if (point) {
          execute(new RemoveControlPointCommand(point, index));
          setSelectedPointId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPointId, points, execute, setSelectedPointId]);

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
          onPointerDown={handlePointPointerDown(point.id, point.position)}
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
