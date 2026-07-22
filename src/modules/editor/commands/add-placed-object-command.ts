import { useTrackStore } from "@/store/track-store";
import type { PlacedObject } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

export class AddPlacedObjectCommand implements Command {
  label = "Place object";

  constructor(private object: PlacedObject) {}

  execute() {
    useTrackStore.getState().insertPlacedObject(this.object);
  }

  undo() {
    useTrackStore.getState().removePlacedObjectById(this.object.id);
  }
}
