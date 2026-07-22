import { useTrackStore } from "@/store/track-store";
import type { RoadControlPoint } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

export class AddControlPointCommand implements Command {
  label = "Add point";

  // index is used for mid-segment splits (Phase 11) -- omitted, it appends
  // to the end, the original "click to extend the road" behavior.
  constructor(
    private point: RoadControlPoint,
    private index?: number
  ) {}

  execute() {
    useTrackStore.getState().insertControlPoint(this.point, this.index);
  }

  undo() {
    useTrackStore.getState().removeControlPointById(this.point.id);
  }
}
