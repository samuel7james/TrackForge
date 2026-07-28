"use client";

import type { EditorToolDefinition } from "@/modules/editor/core/tool-registry";
import { useEditorStore } from "@/store/editor-store";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Toolbar({ tools }: { tools: EditorToolDefinition[] }) {
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);
  // The "icon" button size (32px) is below the ~44px touch-target
  // recommendation -- bumped on touch devices only, so desktop's existing
  // pixel-perfect pill is untouched.
  const isTouchDevice = useIsTouchDevice();

  // Pill-shaped floating toolbar, translating editor.html's own glass-pill
  // language (full-radius container + buttons, strong blur, deep soft
  // shadow) into TrackForge's dark theme rather than copying its light
  // colors verbatim -- a stark white pill floating over this app's dark,
  // orange-accented UI would clash instead of feel like the same design.
  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-full border border-border/50 bg-card/90 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = tool.id === activeToolId;
        return (
          <Button
            key={tool.id}
            size="icon"
            variant={isActive ? "default" : "ghost"}
            className={cn("rounded-full", isTouchDevice && "size-11")}
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
