"use client";

import { Mountain, MountainSnow, Paintbrush, TrendingDown, TrendingUp, Waves } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { useTerrainBrushStore } from "@/store/terrain-brush-store";
import type { ToolMode } from "@/modules/terrain/heightmap";
import type { TerrainTextureLayer } from "@/modules/track-format/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const BRUSH_MODES: { id: ToolMode; label: string; icon: typeof Mountain }[] = [
  { id: "raise", label: "Raise", icon: TrendingUp },
  { id: "lower", label: "Lower", icon: TrendingDown },
  { id: "flatten", label: "Flatten", icon: Waves },
  { id: "smooth", label: "Smooth", icon: MountainSnow },
  { id: "noise", label: "Noise", icon: Mountain },
  { id: "paint", label: "Paint", icon: Paintbrush },
];

const PAINT_LAYERS: { id: TerrainTextureLayer["type"]; label: string }[] = [
  { id: "grass", label: "Grass" },
  { id: "dirt", label: "Dirt" },
  { id: "rock", label: "Rock" },
];

export function TerrainBrushPanel() {
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const mode = useTerrainBrushStore((s) => s.mode);
  const setMode = useTerrainBrushStore((s) => s.setMode);
  const radiusCells = useTerrainBrushStore((s) => s.radiusCells);
  const setRadiusCells = useTerrainBrushStore((s) => s.setRadiusCells);
  const strength = useTerrainBrushStore((s) => s.strength);
  const setStrength = useTerrainBrushStore((s) => s.setStrength);
  const paintLayer = useTerrainBrushStore((s) => s.paintLayer);
  const setPaintLayer = useTerrainBrushStore((s) => s.setPaintLayer);

  if (activeToolId !== "terrain") return null;

  return (
    <div className="pointer-events-auto w-56 rounded-lg border border-border/50 bg-card/90 p-4 shadow-lg backdrop-blur">
      <h3 className="mb-3 text-sm font-medium">Terrain brush</h3>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {BRUSH_MODES.map((brush) => (
            <Button
              key={brush.id}
              size="icon"
              variant={mode === brush.id ? "default" : "ghost"}
              title={brush.label}
              onClick={() => setMode(brush.id)}
            >
              <brush.icon className="size-4" />
            </Button>
          ))}
        </div>

        {mode === "paint" && (
          <div>
            <Label className="mb-1 block text-xs uppercase text-muted-foreground">Layer</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAINT_LAYERS.map((layer) => (
                <Button
                  key={layer.id}
                  size="sm"
                  variant={paintLayer === layer.id ? "default" : "outline"}
                  onClick={() => setPaintLayer(layer.id)}
                >
                  {layer.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="mb-1 flex items-center justify-between text-xs uppercase text-muted-foreground">
            <span>Radius</span>
            <span>{radiusCells}</span>
          </Label>
          <Slider
            value={[radiusCells]}
            min={1}
            max={12}
            step={1}
            onValueChange={(value) => setRadiusCells(Array.isArray(value) ? value[0] : value)}
          />
        </div>

        <div>
          <Label className="mb-1 flex items-center justify-between text-xs uppercase text-muted-foreground">
            <span>Strength</span>
            <span>{strength.toFixed(2)}</span>
          </Label>
          <Slider
            value={[strength]}
            min={0.05}
            max={2}
            step={0.05}
            onValueChange={(value) => setStrength(Array.isArray(value) ? value[0] : value)}
          />
        </div>
      </div>
    </div>
  );
}
