"use client";

import * as THREE from "three";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { UpdateControlPointCommand } from "@/modules/editor/commands/update-control-point-command";
import { computeAutoTangent } from "@/modules/spline/road-curve";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AXES = ["x", "y", "z"] as const;

export function InspectorPanel() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const points = useTrackStore((s) => s.document.splines[0]?.points ?? []);
  const closed = useTrackStore((s) => s.document.splines[0]?.closed ?? false);
  const execute = useCommandStack((s) => s.execute);

  const point = points.find((p) => p.id === selectedId);
  if (!point) return null;

  const setTangentMode = (mode: "auto" | "manual") => {
    if (mode === point.tangentMode) return;
    if (mode === "auto") {
      execute(
        new UpdateControlPointCommand(
          point.id,
          { tangentMode: point.tangentMode },
          { tangentMode: "auto" }
        )
      );
      return;
    }
    // Freeze the current auto tangent as the starting manual handle so
    // toggling to manual doesn't visually snap the corner straight.
    const positions = points.map(
      (p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z)
    );
    const index = points.findIndex((p) => p.id === point.id);
    const tangent = computeAutoTangent(positions, closed, index);
    const tangentVec = { x: tangent.x, y: tangent.y, z: tangent.z };
    execute(
      new UpdateControlPointCommand(
        point.id,
        { tangentMode: point.tangentMode, tangentIn: point.tangentIn, tangentOut: point.tangentOut },
        { tangentMode: "manual", tangentIn: tangentVec, tangentOut: tangentVec }
      )
    );
  };

  return (
    <div className="pointer-events-auto w-56 rounded-lg border border-border/50 bg-card/90 p-4 shadow-lg backdrop-blur">
      <h3 className="mb-3 text-sm font-medium">Control point</h3>

      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs uppercase text-muted-foreground">
            Position
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {AXES.map((axis) => (
              <Input
                key={`${point.id}-${axis}-${point.position[axis]}`}
                type="number"
                step={0.5}
                defaultValue={Number(point.position[axis].toFixed(2))}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (Number.isNaN(value) || value === point.position[axis]) return;
                  execute(
                    new UpdateControlPointCommand(
                      point.id,
                      { position: point.position },
                      { position: { ...point.position, [axis]: value } }
                    )
                  );
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs uppercase text-muted-foreground">
            Width
          </Label>
          <Input
            key={`${point.id}-width-${point.width}`}
            type="number"
            step={0.5}
            min={1}
            defaultValue={Number(point.width.toFixed(1))}
            onBlur={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isNaN(value) || value === point.width || value < 1) return;
              execute(
                new UpdateControlPointCommand(
                  point.id,
                  { width: point.width },
                  { width: value }
                )
              );
            }}
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs uppercase text-muted-foreground">
            Banking (°)
          </Label>
          <Input
            key={`${point.id}-banking-${point.banking}`}
            type="number"
            step={1}
            defaultValue={Number(point.banking.toFixed(1))}
            onBlur={(e) => {
              const value = parseFloat(e.target.value);
              if (Number.isNaN(value) || value === point.banking) return;
              execute(
                new UpdateControlPointCommand(
                  point.id,
                  { banking: point.banking },
                  { banking: value }
                )
              );
            }}
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs uppercase text-muted-foreground">
            Corner style
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant={point.tangentMode === "auto" ? "default" : "outline"}
              className={cn(point.tangentMode !== "auto" && "text-muted-foreground")}
              onClick={() => setTangentMode("auto")}
            >
              Auto
            </Button>
            <Button
              size="sm"
              variant={point.tangentMode === "manual" ? "default" : "outline"}
              className={cn(point.tangentMode !== "manual" && "text-muted-foreground")}
              onClick={() => setTangentMode("manual")}
            >
              Manual
            </Button>
          </div>
          {point.tangentMode === "manual" && (
            <p className="mt-1.5 text-xs text-muted-foreground/70">
              Drag the two handles on the point in the viewport to reshape the corner.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground/70">
          Elevation is the Position Y field above.
        </p>
      </div>
    </div>
  );
}
