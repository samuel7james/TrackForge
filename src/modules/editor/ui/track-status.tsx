"use client";

import { AlertTriangle, CheckCircle2, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTrackStore } from "@/store/track-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { ToggleSplineClosedCommand } from "@/modules/editor/commands/toggle-spline-closed-command";
import { useTrackValidation } from "@/modules/track-format/hooks";

const MIN_POINTS_TO_CLOSE = 3;

export function TrackStatus() {
  const spline = useTrackStore((s) => s.document.splines[0]);
  const execute = useCommandStack((s) => s.execute);
  const { isValid, issues } = useTrackValidation();

  if (!spline) return null;

  return (
    <div className="flex items-center gap-1 border-l border-border/50 pl-3">
      {spline.points.length >= MIN_POINTS_TO_CLOSE && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            execute(new ToggleSplineClosedCommand(spline.id, spline.closed))
          }
          title={spline.closed ? "Open loop" : "Close loop"}
        >
          {spline.closed ? <Link2Off className="size-4" /> : <Link2 className="size-4" />}
        </Button>
      )}

      <Tooltip>
        <TooltipTrigger
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            isValid ? "text-emerald-400" : "text-amber-400"
          )}
        >
          {isValid ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <AlertTriangle className="size-3.5" />
          )}
          {isValid ? "Ready to race" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
        </TooltipTrigger>
        <TooltipContent>
          {isValid ? (
            "Complete, raceable lap."
          ) : (
            <ul className="list-disc space-y-0.5 pl-3">
              {issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
