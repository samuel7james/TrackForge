"use client";

import { useRef, useState } from "react";
import { Cloud, CloudFog, CloudRain, CloudSnow, Moon, Sun, Sunset, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTrackStore } from "@/store/track-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { UpdateEnvironmentCommand } from "@/modules/editor/commands/update-environment-command";
import { WEATHER_PRESETS, WEATHER_TYPES } from "@/modules/environment/weather-presets";
import type { Weather } from "@/modules/track-format/schema";

const WEATHER_ICONS: Record<Weather, LucideIcon> = {
  sunny: Sun,
  sunset: Sunset,
  night: Moon,
  rain: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  cloudy: Cloud,
};

function toValue(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}

export function EnvironmentDialog() {
  const [open, setOpen] = useState(false);
  const environment = useTrackStore((s) => s.document.environment);
  const execute = useCommandStack((s) => s.execute);

  // Live value applied directly to the store on every onValueChange (real-
  // time preview while dragging), with a single UpdateEnvironmentCommand
  // recorded on release (onValueCommitted) -- same "apply live, commit once"
  // shape as control-point dragging and terrain brush strokes, so a slider
  // drag doesn't flood the undo stack with one entry per pixel moved.
  const timeDragStart = useRef<number | null>(null);
  const fogDragStart = useRef<number | null>(null);

  const selectPreset = (weather: Weather) => {
    if (weather === environment.weather) return;
    const preset = WEATHER_PRESETS[weather];
    execute(
      new UpdateEnvironmentCommand(
        { weather: environment.weather, timeOfDay: environment.timeOfDay, fogDensity: environment.fogDensity },
        { weather, timeOfDay: preset.defaultTimeOfDay, fogDensity: preset.defaultFogDensity }
      )
    );
  };

  const ActiveIcon = WEATHER_ICONS[environment.weather];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="gap-1.5" />}>
        <ActiveIcon className="size-4" />
        {WEATHER_PRESETS[environment.weather].label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Weather &amp; lighting</DialogTitle>
          <DialogDescription>
            Pick a preset, then fine-tune time of day and fog live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5">
            {WEATHER_TYPES.map((type) => {
              const Icon = WEATHER_ICONS[type];
              return (
                <Button
                  key={type}
                  size="sm"
                  variant={environment.weather === type ? "default" : "outline"}
                  className="h-auto flex-col gap-1 py-3"
                  onClick={() => selectPreset(type)}
                >
                  <Icon className="size-4" />
                  <span className="text-[11px]">{WEATHER_PRESETS[type].label}</span>
                </Button>
              );
            })}
          </div>

          <div>
            <Label className="mb-1 flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>Time of day</span>
              <span>{formatHour(environment.timeOfDay)}</span>
            </Label>
            <Slider
              value={[environment.timeOfDay]}
              min={0}
              max={24}
              step={0.5}
              onValueChange={(value) => {
                const next = toValue(value);
                if (timeDragStart.current === null) timeDragStart.current = environment.timeOfDay;
                useTrackStore.getState().patchEnvironment({ timeOfDay: next });
              }}
              onValueCommitted={(value) => {
                const next = toValue(value);
                const before = timeDragStart.current;
                timeDragStart.current = null;
                if (before !== null && before !== next) {
                  execute(new UpdateEnvironmentCommand({ timeOfDay: before }, { timeOfDay: next }));
                }
              }}
            />
          </div>

          <div>
            <Label className="mb-1 flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>Fog density</span>
              <span>{environment.fogDensity.toFixed(3)}</span>
            </Label>
            <Slider
              value={[environment.fogDensity]}
              min={0}
              max={0.06}
              step={0.001}
              onValueChange={(value) => {
                const next = toValue(value);
                if (fogDragStart.current === null) fogDragStart.current = environment.fogDensity;
                useTrackStore.getState().patchEnvironment({ fogDensity: next });
              }}
              onValueCommitted={(value) => {
                const next = toValue(value);
                const before = fogDragStart.current;
                fogDragStart.current = null;
                if (before !== null && before !== next) {
                  execute(new UpdateEnvironmentCommand({ fogDensity: before }, { fogDensity: next }));
                }
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
