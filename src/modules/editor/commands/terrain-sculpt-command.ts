import { useTrackStore } from "@/store/track-store";
import type { TerrainTextureLayer } from "@/modules/track-format/schema";
import type { Command } from "@/modules/editor/core/command";

export interface TerrainSnapshot {
  heightmap: number[];
  textureLayers: TerrainTextureLayer[];
}

// One command per whole brush stroke (pointer down -> up), not per dab --
// otherwise a single drag would push dozens of undo-stack entries. Sculpt
// and paint strokes share this command since both mutate the same terrain
// slice and are mutually exclusive per stroke.
export class TerrainSculptCommand implements Command {
  label = "Sculpt terrain";

  constructor(
    private before: TerrainSnapshot,
    private after: TerrainSnapshot
  ) {}

  execute() {
    useTrackStore.getState().setTerrainHeightmap(this.after.heightmap);
    useTrackStore.getState().setTerrainTextureLayers(this.after.textureLayers);
  }

  undo() {
    useTrackStore.getState().setTerrainHeightmap(this.before.heightmap);
    useTrackStore.getState().setTerrainTextureLayers(this.before.textureLayers);
  }
}
