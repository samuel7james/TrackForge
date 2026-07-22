"use client";

import { useEditorStore } from "@/store/editor-store";
import { usePropPaletteStore } from "@/store/prop-palette-store";
import { PROP_REGISTRY, PROP_TYPES } from "@/modules/objects/prop-registry";
import { Button } from "@/components/ui/button";

export function PropPalettePanel() {
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const selectedType = usePropPaletteStore((s) => s.selectedType);
  const setSelectedType = usePropPaletteStore((s) => s.setSelectedType);

  if (activeToolId !== "object") return null;

  return (
    <div className="pointer-events-auto w-56 rounded-lg border border-border/50 bg-card/90 p-4 shadow-lg backdrop-blur">
      <h3 className="mb-3 text-sm font-medium">Place object</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {PROP_TYPES.map((type) => {
          const def = PROP_REGISTRY[type];
          const Icon = def.icon;
          return (
            <Button
              key={type}
              size="icon"
              variant={selectedType === type ? "default" : "ghost"}
              title={def.label}
              onClick={() => setSelectedType(type)}
            >
              <Icon className="size-4" />
            </Button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground/70">
        Click the ground to place a {PROP_REGISTRY[selectedType].label.toLowerCase()}
      </p>
    </div>
  );
}
