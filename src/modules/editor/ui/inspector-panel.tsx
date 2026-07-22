"use client";

import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { UpdateControlPointCommand } from "@/modules/editor/commands/update-control-point-command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AXES = ["x", "y", "z"] as const;

export function InspectorPanel() {
  const selectedPointId = useEditorStore((s) => s.selectedPointId);
  const points = useTrackStore((s) => s.document.splines[0]?.points ?? []);
  const execute = useCommandStack((s) => s.execute);

  const point = points.find((p) => p.id === selectedPointId);
  if (!point) return null;

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

        <p className="text-xs text-muted-foreground/70">
          Banking &amp; elevation editing arrive in Milestone 2.
        </p>
      </div>
    </div>
  );
}
