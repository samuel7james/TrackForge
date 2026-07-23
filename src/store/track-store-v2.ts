import { create } from "zustand";
import {
  createEmptyTrackDocumentV2,
  type Difficulty,
  type PlacedObject,
  type TrackDocumentV2,
} from "@/modules/track-format/schema";
import type { Cell } from "@/modules/game-engine/track";

// Parallel to track-store.ts (v1, spline/terrain) rather than a shared
// generic store -- the two documents' mutations are genuinely different
// shapes (tile cells vs. splines/heightmap), and the v1 store stays
// untouched/at no risk this way. setSlug/setMeta/loadDocument mirror v1's
// own persistence-related actions (bypass undo/redo, same reasoning as
// track-store.ts's own comment on this).
type EnvironmentPatch = Partial<TrackDocumentV2["environment"]>;

export interface TrackMetaPatchV2 {
  name?: string;
  description?: string;
  difficulty?: Difficulty;
  tags?: string[];
}

interface TrackStateV2 {
  document: TrackDocumentV2;
  setCells: (cells: Cell[]) => void;
  insertPlacedObject: (object: PlacedObject) => void;
  removePlacedObjectById: (objectId: string) => void;
  patchPlacedObject: (objectId: string, patch: Partial<PlacedObject>) => void;
  patchEnvironment: (patch: EnvironmentPatch) => void;

  setSlug: (slug: string) => void;
  setMeta: (patch: TrackMetaPatchV2) => void;
  loadDocument: (document: TrackDocumentV2) => void;
}

export const useTrackStoreV2 = create<TrackStateV2>((set) => ({
  document: createEmptyTrackDocumentV2(),

  setCells: (cells) =>
    set((state) => ({
      document: { ...state.document, track: { ...state.document.track, cells } },
    })),

  insertPlacedObject: (object) =>
    set((state) => ({
      document: { ...state.document, objects: [...state.document.objects, object] },
    })),

  removePlacedObjectById: (objectId) =>
    set((state) => ({
      document: {
        ...state.document,
        objects: state.document.objects.filter((o) => o.id !== objectId),
      },
    })),

  patchPlacedObject: (objectId, patch) =>
    set((state) => ({
      document: {
        ...state.document,
        objects: state.document.objects.map((o) =>
          o.id === objectId ? { ...o, ...patch } : o
        ),
      },
    })),

  patchEnvironment: (patch) =>
    set((state) => ({
      document: { ...state.document, environment: { ...state.document.environment, ...patch } },
    })),

  setSlug: (slug) =>
    set((state) => ({
      document: { ...state.document, meta: { ...state.document.meta, slug } },
    })),

  setMeta: (patch) =>
    set((state) => ({
      document: { ...state.document, meta: { ...state.document.meta, ...patch } },
    })),

  loadDocument: (document) => set({ document }),
}));
