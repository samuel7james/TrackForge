"use client";

import { TOOLS } from "@/modules/editor/core/tool-registry";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";

export function Toolbar() {
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);

  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-border/50 bg-card/90 p-1.5 shadow-lg backdrop-blur">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = tool.id === activeToolId;
        return (
          <Button
            key={tool.id}
            size="icon"
            variant={isActive ? "default" : "ghost"}
            onClick={() => setActiveToolId(tool.id)}
            title={`${tool.label} (${tool.shortcut.toUpperCase()})`}
          >
            <Icon className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}
