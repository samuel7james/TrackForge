"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { UpdateControlPointCommand } from "@/modules/editor/commands/update-control-point-command";

const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
const AXIS = new THREE.Vector3(0, 1, 0);

// A single-axis (Y-only) drag handle for the selected point's elevation.
// PointEditingLayer's drag plane is horizontal (it needs to be, for normal
// x/z repositioning), so it's the only way to change a point's height in the
// viewport rather than typing into the inspector's Position Y field. Uses a
// plane containing the vertical axis through the point, rotated to face the
// camera as much as possible -- the standard technique for a single-axis
// gizmo drag, so the ray intersection reliably yields just a Y value.
export function ElevationHandle() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const setIsDraggingControlPoint = useEditorStore((s) => s.setIsDraggingControlPoint);
  const points = useTrackStore((s) => s.document.splines[0]?.points ?? []);
  const execute = useCommandStack((s) => s.execute);
  const camera = useThree((s) => s.camera);

  const point = points.find((p) => p.id === selectedId);
  const dragStartY = useRef<number | null>(null);

  const beginDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!point) return;
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragStartY.current = point.position.y;
      setIsDraggingControlPoint(true);

      const pointWorld = new THREE.Vector3(point.position.x, point.position.y, point.position.z);
      const toCamera = camera.position.clone().sub(pointWorld);
      const normal = toCamera.sub(AXIS.clone().multiplyScalar(toCamera.dot(AXIS)));
      if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
      normal.normalize();
      dragPlane.setFromNormalAndCoplanarPoint(normal, pointWorld);
    },
    [point, camera, setIsDraggingControlPoint]
  );

  const handleMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (dragStartY.current === null || !point) return;
      e.stopPropagation();
      if (!e.ray.intersectPlane(dragPlane, dragPoint)) return;
      useTrackStore.getState().patchControlPoint(point.id, {
        position: { x: point.position.x, y: dragPoint.y, z: point.position.z },
      });
    },
    [point]
  );

  const endDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const from = dragStartY.current;
      dragStartY.current = null;
      if (from === null || !point) return;
      e.stopPropagation();
      setIsDraggingControlPoint(false);
      const current = useTrackStore
        .getState()
        .document.splines[0]?.points.find((p) => p.id === point.id);
      if (!current || current.position.y === from) return;
      execute(
        new UpdateControlPointCommand(
          point.id,
          { position: { ...current.position, y: from } },
          { position: current.position }
        )
      );
    },
    [execute, point, setIsDraggingControlPoint]
  );

  if (!point) return null;

  return (
    <mesh
      position={[point.position.x, point.position.y + 1.1, point.position.z]}
      onPointerDown={beginDrag}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onClick={(e) => e.stopPropagation()}
    >
      <coneGeometry args={[0.25, 0.6, 12]} />
      <meshStandardMaterial color="#f2c94c" emissive="#f2c94c" emissiveIntensity={0.3} />
    </mesh>
  );
}
