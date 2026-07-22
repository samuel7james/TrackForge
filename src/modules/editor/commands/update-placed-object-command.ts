import { useTrackStore } from "@/store/track-store";
import type { PlacedObject } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

// Generic patch command -- covers dragging (position), inspector edits
// (rotation, scale), matching UpdateControlPointCommand's shape.
export class UpdatePlacedObjectCommand implements Command {
  label = "Update object";

  constructor(
    private objectId: string,
    private before: Partial<PlacedObject>,
    private after: Partial<PlacedObject>
  ) {}

  execute() {
    useTrackStore.getState().patchPlacedObject(this.objectId, this.after);
  }

  undo() {
    useTrackStore.getState().patchPlacedObject(this.objectId, this.before);
  }
}
