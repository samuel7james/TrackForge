import { useTrackStore } from "@/store/track-store";
import type { RoadControlPoint } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

// Generic patch command — covers both dragging (position) and inspector
// edits (width, and later banking/elevation) with one implementation.
export class UpdateControlPointCommand implements Command {
  label = "Update point";

  constructor(
    private pointId: string,
    private before: Partial<RoadControlPoint>,
    private after: Partial<RoadControlPoint>
  ) {}

  execute() {
    useTrackStore.getState().patchControlPoint(this.pointId, this.after);
  }

  undo() {
    useTrackStore.getState().patchControlPoint(this.pointId, this.before);
  }
}
