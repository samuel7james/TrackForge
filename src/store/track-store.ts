import { create } from "zustand";
import {
  createEmptyTrackDocument,
  type RoadControlPoint,
  type TrackDocument,
} from "@/modules/track-format/schema";

interface TrackState {
  document: TrackDocument;
  // Pure mutations — no id generation or decision-making here. Commands
  // (modules/editor/commands) own that; these just apply already-formed
  // data so undo/redo can call them symmetrically.
  insertControlPoint: (point: RoadControlPoint, index?: number) => void;
  removeControlPointById: (pointId: string) => void;
  patchControlPoint: (pointId: string, patch: Partial<RoadControlPoint>) => void;
  setSplineClosed: (splineId: string, closed: boolean) => void;

  // Persistence-related — bypass the Command stack entirely (system actions,
  // not user edits; undo shouldn't un-assign a slug or un-load a document).
  setSlug: (slug: string) => void;
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

  setSlug: (slug) =>
    set((state) => ({
      document: { ...state.document, meta: { ...state.document.meta, slug } },
    })),

  loadDocument: (document) => set({ document }),
}));
