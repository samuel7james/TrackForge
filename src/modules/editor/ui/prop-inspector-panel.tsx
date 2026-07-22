"use client";

import * as THREE from "three";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { UpdatePlacedObjectCommand } from "@/modules/editor/commands/update-placed-object-command";
import { PROP_REGISTRY, isPropType } from "@/modules/objects/prop-registry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Rotation is stored as a full quaternion (schema.ts, shared with
// checkpoints/start line) but this UI only exposes yaw -- props sit on
// (roughly) flat ground, so pitch/roll aren't something placement needs.
function yawDegrees(rotation: { x: number; y: number; z: number; w: number }): number {
  const euler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    "YXZ"
  );
  return THREE.MathUtils.radToDeg(euler.y);
}

function quaternionFromYaw(degrees: number): { x: number; y: number; z: number; w: number } {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, THREE.MathUtils.degToRad(degrees), 0, "YXZ")
  );
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

export function PropInspectorPanel() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const objects = useTrackStore((s) => s.document.objects);
  const execute = useCommandStack((s) => s.execute);

  const object = objects.find((o) => o.id === selectedId);
  if (!object || !isPropType(object.type)) return null;

  const label = PROP_REGISTRY[object.type].label;
  const yaw = yawDegrees(object.rotation);

  return (
    <div className="pointer-events-auto w-56 rounded-lg border border-border/50 bg-card/90 p-4 shadow-lg backdrop-blur">
      <h3 className="mb-3 text-sm font-medium">{label}</h3>

      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs uppercase text-muted-foreground">
            Rotation (°)
          </Label>
          <Input
            key={`${object.id}-yaw-${yaw.toFixed(1)}`}
            type="number"
            step={5}
            defaultValue={Number(yaw.toFixed(1))}
            onBlur={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isNaN(value) || value === yaw) return;
              execute(
                new UpdatePlacedObjectCommand(
                  object.id,
                  { rotation: object.rotation },
                  { rotation: quaternionFromYaw(value) }
                )
              );
            }}
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs uppercase text-muted-foreground">Scale</Label>
          <Input
            key={`${object.id}-scale-${object.scale.x}`}
            type="number"
            step={0.1}
            min={0.1}
            defaultValue={Number(object.scale.x.toFixed(2))}
            onBlur={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isNaN(value) || value === object.scale.x || value < 0.1) return;
              execute(
                new UpdatePlacedObjectCommand(
                  object.id,
                  { scale: object.scale },
                  { scale: { x: value, y: value, z: value } }
                )
              );
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground/70">
          Drag in the viewport to move · Delete to remove
        </p>
      </div>
    </div>
  );
}
