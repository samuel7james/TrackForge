import { create } from "zustand";
import {
  createEmptyTrackDocument,
  type Difficulty,
  type PlacedObject,
  type TrackDocument,
} from "@/modules/track-format/schema";
import type { Cell } from "@/modules/game-engine/track";

// setSlug/setMeta/loadDocument bypass undo/redo -- these are
// persistence-related state changes, not user edits that should be
// undoable.
type EnvironmentPatch = Partial<TrackDocument["environment"]>;

export interface TrackMetaPatch {
  name?: string;
  description?: string;
  difficulty?: Difficulty;
  tags?: string[];
}

interface TrackState {
  document: TrackDocument;
  setCells: (cells: Cell[]) => void;
  insertPlacedObject: (object: PlacedObject) => void;
  removePlacedObjectById: (objectId: string) => void;
  patchPlacedObject: (objectId: string, patch: Partial<PlacedObject>) => void;
  patchEnvironment: (patch: EnvironmentPatch) => void;

  setSlug: (slug: string) => void;
  setMeta: (patch: TrackMetaPatch) => void;
  loadDocument: (document: TrackDocument) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  document: createEmptyTrackDocument(),

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
