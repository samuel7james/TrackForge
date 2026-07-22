import { useTrackStore } from "@/store/track-store";
import type { Command } from "@/modules/editor/core/command";

export class ToggleSplineClosedCommand implements Command {
  label = "Toggle closed loop";

  constructor(
    private splineId: string,
    private wasClosed: boolean
  ) {}

  execute() {
    useTrackStore.getState().setSplineClosed(this.splineId, !this.wasClosed);
  }

  undo() {
    useTrackStore.getState().setSplineClosed(this.splineId, this.wasClosed);
  }
}
