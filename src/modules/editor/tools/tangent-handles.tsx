"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { UpdateControlPointCommand } from "@/modules/editor/commands/update-control-point-command";
import type { Vec3 } from "@/modules/track-format/schema";

const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function toVec3(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

interface Drag {
  pointId: string;
  kind: "in" | "out";
  from: Vec3;
}

// Draggable Hermite tangent handles for the selected point, shown only while
// its Corner style is "manual" (InspectorPanel). "Out" points in the
// direction of travel, "in" points backward -- independent of each other (a
// "broken" handle), matching tangentIn/tangentOut already being stored
// separately in the schema.
export function TangentHandles() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const setIsDraggingControlPoint = useEditorStore((s) => s.setIsDraggingControlPoint);
  const points = useTrackStore((s) => s.document.splines[0]?.points ?? []);
  const execute = useCommandStack((s) => s.execute);

  const point = points.find((p) => p.id === selectedId);
  const dragging = useRef<Drag | null>(null);

  const beginDrag = useCallback(
    (kind: "in" | "out") => (e: ThreeEvent<PointerEvent>) => {
      if (!point) return;
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragging.current = { pointId: point.id, kind, from: kind === "in" ? point.tangentIn : point.tangentOut };
      setIsDraggingControlPoint(true);
      dragPlane.setFromNormalAndCoplanarPoint(
        UP,
        new THREE.Vector3(point.position.x, point.position.y, point.position.z)
      );
    },
    [point, setIsDraggingControlPoint]
  );

  const handleMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const drag = dragging.current;
      if (!drag || !point) return;
      e.stopPropagation();
      if (!e.ray.intersectPlane(dragPlane, dragPoint)) return;
      const base = new THREE.Vector3(point.position.x, point.position.y, point.position.z);
      const handleVec = dragPoint.clone().sub(base);
      const tangentVec = drag.kind === "out" ? handleVec : handleVec.negate();
      useTrackStore.getState().patchControlPoint(point.id, {
        [drag.kind === "out" ? "tangentOut" : "tangentIn"]: toVec3(tangentVec),
      });
    },
    [point]
  );

  const endDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const drag = dragging.current;
      dragging.current = null;
      if (!drag) return;
      e.stopPropagation();
      setIsDraggingControlPoint(false);
      const current = useTrackStore
        .getState()
        .document.splines[0]?.points.find((p) => p.id === drag.pointId);
      if (!current) return;
      const to = drag.kind === "in" ? current.tangentIn : current.tangentOut;
      if (to.x !== drag.from.x || to.y !== drag.from.y || to.z !== drag.from.z) {
        const key = drag.kind === "in" ? "tangentIn" : "tangentOut";
        execute(new UpdateControlPointCommand(drag.pointId, { [key]: drag.from }, { [key]: to }));
      }
    },
    [execute, setIsDraggingControlPoint]
  );

  if (!point || point.tangentMode !== "manual") return null;

  const base = new THREE.Vector3(point.position.x, point.position.y + 0.05, point.position.z);
  const outHandle = base
    .clone()
    .add(new THREE.Vector3(point.tangentOut.x, point.tangentOut.y, point.tangentOut.z));
  const inHandle = base
    .clone()
    .sub(new THREE.Vector3(point.tangentIn.x, point.tangentIn.y, point.tangentIn.z));

  return (
    <group>
      <Line points={[base, outHandle]} color="#7ee787" lineWidth={1.5} />
      <Line points={[base, inHandle]} color="#7ee787" lineWidth={1.5} />
      <mesh
        position={outHandle}
        onPointerDown={beginDrag("out")}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onClick={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#7ee787" emissive="#7ee787" emissiveIntensity={0.4} />
      </mesh>
      <mesh
        position={inHandle}
        onPointerDown={beginDrag("in")}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onClick={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#7ee787" emissive="#7ee787" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}
