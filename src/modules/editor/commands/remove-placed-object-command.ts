import { useTrackStore } from "@/store/track-store";
import type { PlacedObject } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

// Unlike control points, a placed object's position in the array carries no
// meaning (no curve topology depends on ordering), so undo doesn't need to
// restore a specific index -- re-appending is equivalent.
export class RemovePlacedObjectCommand implements Command {
  label = "Remove object";

  constructor(private object: PlacedObject) {}

  execute() {
    useTrackStore.getState().removePlacedObjectById(this.object.id);
  }

  undo() {
    useTrackStore.getState().insertPlacedObject(this.object);
  }
}
