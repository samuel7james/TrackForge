import { useTrackStore } from "@/store/track-store";
import type { RoadControlPoint } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

export class RemoveControlPointCommand implements Command {
  label = "Remove point";

  constructor(
    private point: RoadControlPoint,
    private index: number
  ) {}

  execute() {
    useTrackStore.getState().removeControlPointById(this.point.id);
  }

  undo() {
    useTrackStore.getState().insertControlPoint(this.point, this.index);
  }
}
