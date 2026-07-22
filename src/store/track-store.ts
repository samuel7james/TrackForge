import { create } from "zustand";

// Minimal stub for Phase 2 — proves SceneRoot renders reactively from store state.
// Replaced by the full TrackDocument-backed store in Phase 3 (modules/track-format).
interface TrackState {
  name: string;
}

export const useTrackStore = create<TrackState>(() => ({
  name: "Untitled Track",
}));
