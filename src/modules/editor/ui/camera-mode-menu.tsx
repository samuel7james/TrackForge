"use client";

import { Orbit, Move3d, LayoutGrid, Film, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEditorStore, type CameraMode } from "@/store/editor-store";

const CAMERA_MODES: { id: CameraMode; label: string; icon: LucideIcon }[] = [
  { id: "orbit", label: "Orbit", icon: Orbit },
  { id: "freefly", label: "Free Fly", icon: Move3d },
  { id: "topview", label: "Top View", icon: LayoutGrid },
  { id: "cinematic", label: "Cinematic", icon: Film },
];

export function CameraModeMenu() {
  const cameraMode = useEditorStore((s) => s.cameraMode);
  const setCameraMode = useEditorStore((s) => s.setCameraMode);
  const active = CAMERA_MODES.find((m) => m.id === cameraMode) ?? CAMERA_MODES[0];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="ghost" className="gap-1.5" />}>
        <ActiveIcon className="size-4" />
        {active.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {CAMERA_MODES.map((mode) => (
          <DropdownMenuItem key={mode.id} onClick={() => setCameraMode(mode.id)}>
            <mode.icon className="size-4" />
            {mode.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
