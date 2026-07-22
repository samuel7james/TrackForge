"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { usePropPaletteStore } from "@/store/prop-palette-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { AddPlacedObjectCommand } from "@/modules/editor/commands/add-placed-object-command";
import { RemovePlacedObjectCommand } from "@/modules/editor/commands/remove-placed-object-command";
import { UpdatePlacedObjectCommand } from "@/modules/editor/commands/update-placed-object-command";
import { createPlacedObject } from "@/modules/objects/prop-registry";
import type { PlacedObject, Vec3 } from "@/modules/track-format/schema";

const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const EMPTY_OBJECTS: PlacedObject[] = [];

function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

// The Object Tool's placement/selection behavior, parallel to
// PointEditingLayer: an invisible ground click-catcher (only while the
// Object tool is active) appends a new prop of whatever type is chosen in
// PropPalettePanel, and an invisible sphere per existing object (active
// regardless of tool, like control points) handles select + drag. All
// mutations go through the CommandStack; a drag applies live and commits
// one UpdatePlacedObjectCommand on release, same as control point dragging.
export function ObjectPlacementLayer() {
  const objects = useTrackStore((s) => s.document.objects ?? EMPTY_OBJECTS);
  const patchPlacedObject = useTrackStore((s) => s.patchPlacedObject);

  const activeToolId = useEditorStore((s) => s.activeToolId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const setIsDraggingControlPoint = useEditorStore((s) => s.setIsDraggingControlPoint);
  const selectedPropType = usePropPaletteStore((s) => s.selectedType);

  const execute = useCommandStack((s) => s.execute);

  const draggingObjectId = useRef<string | null>(null);
  const dragStartPosition = useRef<Vec3 | null>(null);

  const handleGroundClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const object = createPlacedObject(selectedPropType, { x: e.point.x, y: 0, z: e.point.z });
      execute(new AddPlacedObjectCommand(object));
      setSelectedId(object.id);
    },
    [selectedPropType, execute, setSelectedId]
  );

  const handleObjectPointerDown = useCallback(
    (objectId: string, position: Vec3) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      draggingObjectId.current = objectId;
      dragStartPosition.current = position;
      setSelectedId(objectId);
      setIsDraggingControlPoint(true);
      dragPlane.setFromNormalAndCoplanarPoint(
        UP,
        new THREE.Vector3(position.x, position.y, position.z)
      );
    },
    [setSelectedId, setIsDraggingControlPoint]
  );

  const handleObjectPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const objectId = draggingObjectId.current;
      if (!objectId) return;
      e.stopPropagation();
      if (e.ray.intersectPlane(dragPlane, dragPoint)) {
        patchPlacedObject(objectId, {
          position: { x: dragPoint.x, y: dragPoint.y, z: dragPoint.z },
        });
      }
    },
    [patchPlacedObject]
  );

  const endDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const objectId = draggingObjectId.current;
      const from = dragStartPosition.current;
      draggingObjectId.current = null;
      dragStartPosition.current = null;
      if (!objectId || !from) return;
      e.stopPropagation();
      setIsDraggingControlPoint(false);

      const object = useTrackStore.getState().document.objects.find((o) => o.id === objectId);
      if (!object) return;
      const to = object.position;
      if (to.x !== from.x || to.y !== from.y || to.z !== from.z) {
        execute(new UpdatePlacedObjectCommand(objectId, { position: from }, { position: to }));
      }
    },
    [execute, setIsDraggingControlPoint]
  );

  // Clears any lingering control-point selection so InspectorPanel doesn't
  // render on top of PropPalettePanel in the same corner (mirrors
  // TerrainSculptLayer's equivalent clear-on-tool-entry).
  useEffect(() => {
    if (activeToolId === "object") setSelectedId(null);
  }, [activeToolId, setSelectedId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingIntoField(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const object = objects.find((o) => o.id === selectedId);
        if (object) {
          execute(new RemovePlacedObjectCommand(object));
          setSelectedId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, objects, execute, setSelectedId]);

  return (
    <>
      {activeToolId === "object" && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleGroundClick}
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
          onPointerDown={handleObjectPointerDown(object.id, object.position)}
          onPointerMove={handleObjectPointerMove}
          onPointerUp={endDrag}
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
