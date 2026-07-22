import { create } from "zustand";
import {
  createEmptyTrackDocument,
  type Difficulty,
  type PlacedObject,
  type RoadControlPoint,
  type TerrainTextureLayer,
  type TrackDocument,
} from "@/modules/track-format/schema";

type EnvironmentPatch = Partial<TrackDocument["environment"]>;

export interface TrackMetaPatch {
  name?: string;
  description?: string;
  difficulty?: Difficulty;
}

interface TrackState {
  document: TrackDocument;
  // Pure mutations — no id generation or decision-making here. Commands
  // (modules/editor/commands) own that; these just apply already-formed
  // data so undo/redo can call them symmetrically.
  insertControlPoint: (point: RoadControlPoint, index?: number) => void;
  removeControlPointById: (pointId: string) => void;
  patchControlPoint: (pointId: string, patch: Partial<RoadControlPoint>) => void;
  setSplineClosed: (splineId: string, closed: boolean) => void;
  setTerrainHeightmap: (heightmap: number[]) => void;
  setTerrainTextureLayers: (textureLayers: TerrainTextureLayer[]) => void;
  insertPlacedObject: (object: PlacedObject) => void;
  removePlacedObjectById: (objectId: string) => void;
  patchPlacedObject: (objectId: string, patch: Partial<PlacedObject>) => void;
  patchEnvironment: (patch: EnvironmentPatch) => void;

  // Persistence-related — bypass the Command stack entirely (system actions,
  // not user edits; undo shouldn't un-assign a slug or un-load a document).
  setSlug: (slug: string) => void;
  setMeta: (patch: TrackMetaPatch) => void;
  loadDocument: (document: TrackDocument) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  document: createEmptyTrackDocument(),

  insertControlPoint: (point, index) =>
    set((state) => {
      const [spline, ...rest] = state.document.splines;
      const points = [...spline.points];
      if (index === undefined || index >= points.length) {
        points.push(point);
      } else {
        points.splice(index, 0, point);
      }
      return {
        document: {
          ...state.document,
          splines: [{ ...spline, points }, ...rest],
        },
      };
    }),

  removeControlPointById: (pointId) =>
    set((state) => {
      const [spline, ...rest] = state.document.splines;
      return {
        document: {
          ...state.document,
          splines: [
            { ...spline, points: spline.points.filter((p) => p.id !== pointId) },
            ...rest,
          ],
        },
      };
    }),

  patchControlPoint: (pointId, patch) =>
    set((state) => {
      const [spline, ...rest] = state.document.splines;
      return {
        document: {
          ...state.document,
          splines: [
            {
              ...spline,
              points: spline.points.map((p) =>
                p.id === pointId ? { ...p, ...patch } : p
              ),
            },
            ...rest,
          ],
        },
      };
    }),

  setSplineClosed: (splineId, closed) =>
    set((state) => ({
      document: {
        ...state.document,
        splines: state.document.splines.map((s) =>
          s.id === splineId ? { ...s, closed } : s
        ),
      },
    })),

  setTerrainHeightmap: (heightmap) =>
    set((state) => ({
      document: {
        ...state.document,
        terrain: { ...state.document.terrain, heightmap },
      },
    })),

  setTerrainTextureLayers: (textureLayers) =>
    set((state) => ({
      document: {
        ...state.document,
        terrain: { ...state.document.terrain, textureLayers },
      },
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
