import { create } from "zustand";
import {
  createEmptyTrackDocument,
  type RoadControlPoint,
  type TrackDocument,
  type Vec3,
} from "@/modules/track-format/schema";

const DEFAULT_ROAD_WIDTH = 8;

function createControlPoint(position: Vec3): RoadControlPoint {
  return {
    id: crypto.randomUUID(),
    position,
    tangentIn: { x: 0, y: 0, z: 0 },
    tangentOut: { x: 0, y: 0, z: 0 },
    width: DEFAULT_ROAD_WIDTH,
    banking: 0,
    elevation: 0,
  };
}

interface TrackState {
  document: TrackDocument;
  addControlPoint: (position: Vec3) => void;
  moveControlPoint: (pointId: string, position: Vec3) => void;
  removeControlPoint: (pointId: string) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  document: createEmptyTrackDocument(),

  // Milestone 1 UI only ever manages a single spline — the schema supports
  // many (split/merge arrives in Milestone 2), so we create it lazily here.
  addControlPoint: (position) =>
    set((state) => {
      const { document } = state;
      const point = createControlPoint(position);

      if (document.splines.length === 0) {
        return {
          document: {
            ...document,
            splines: [{ id: crypto.randomUUID(), closed: false, points: [point] }],
          },
        };
      }

      const [spline, ...rest] = document.splines;
      return {
        document: {
          ...document,
          splines: [{ ...spline, points: [...spline.points, point] }, ...rest],
        },
      };
    }),

  moveControlPoint: (pointId, position) =>
    set((state) => ({
      document: {
        ...state.document,
        splines: state.document.splines.map((spline) => ({
          ...spline,
          points: spline.points.map((p) =>
            p.id === pointId ? { ...p, position } : p
          ),
        })),
      },
    })),

  removeControlPoint: (pointId) =>
    set((state) => ({
      document: {
        ...state.document,
        splines: state.document.splines.map((spline) => ({
          ...spline,
          points: spline.points.filter((p) => p.id !== pointId),
        })),
      },
    })),
}));
