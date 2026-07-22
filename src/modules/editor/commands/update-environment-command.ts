import { useTrackStore } from "@/store/track-store";
import type { TrackDocument } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

type EnvironmentPatch = Partial<TrackDocument["environment"]>;

export class UpdateEnvironmentCommand implements Command {
  label = "Change weather";

  constructor(
    private before: EnvironmentPatch,
    private after: EnvironmentPatch
  ) {}

  execute() {
    useTrackStore.getState().patchEnvironment(this.after);
  }

  undo() {
    useTrackStore.getState().patchEnvironment(this.before);
  }
}
