import { useTrackStore } from "@/store/track-store";
import type { RoadControlPoint } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

export class AddControlPointCommand implements Command {
  label = "Add point";

  constructor(private point: RoadControlPoint) {}

  execute() {
    useTrackStore.getState().insertControlPoint(this.point);
  }

  undo() {
    useTrackStore.getState().removeControlPointById(this.point.id);
  }
}
