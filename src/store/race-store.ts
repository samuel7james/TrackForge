import { create } from "zustand";

interface SectorDelta {
  sectorIndex: number;
  deltaMs: number;
}

interface RaceState {
  // Current lap in progress. lapStartTime === null means no lap has started
  // yet (or the vehicle just (re)spawned) — the next start/finish crossing
  // begins timing rather than completing a lap.
  lapStartTime: number | null;
  nextCheckpointIndex: number;
  sectorSplitsMs: number[];

  // Persist across multiple Play sessions within the same page load (only
  // resetCurrentLap runs on each (re)spawn) — "session-only" per TASKS.md,
  // reset on full page reload since this is a plain in-memory store.
  lastLapTimeMs: number | null;
  bestLapTimeMs: number | null;
  bestSectorTimesMs: number[];
  lapHistoryMs: number[];

  lastSectorDelta: SectorDelta | null;

  resetCurrentLap: () => void;
  startLap: (now: number) => void;
  recordSector: (checkpointIndex: number, now: number) => void;
  completeLap: (now: number) => void;
  clearSectorDelta: () => void;
}

export const useRaceStore = create<RaceState>((set) => ({
  lapStartTime: null,
  nextCheckpointIndex: 0,
  sectorSplitsMs: [],

  lastLapTimeMs: null,
  bestLapTimeMs: null,
  bestSectorTimesMs: [],
  lapHistoryMs: [],

  lastSectorDelta: null,

  resetCurrentLap: () =>
    set({
      lapStartTime: null,
      nextCheckpointIndex: 0,
      sectorSplitsMs: [],
      lastSectorDelta: null,
    }),

  startLap: (now) =>
    set({ lapStartTime: now, nextCheckpointIndex: 0, sectorSplitsMs: [] }),

  recordSector: (checkpointIndex, now) =>
    set((state) => {
      if (state.lapStartTime === null || checkpointIndex !== state.nextCheckpointIndex) {
        return state;
      }
      const elapsed = now - state.lapStartTime;
      const previousBest = state.bestSectorTimesMs[checkpointIndex];
      const bestSectorTimesMs = [...state.bestSectorTimesMs];
      const isNewBest = previousBest === undefined || elapsed < previousBest;
      if (isNewBest) bestSectorTimesMs[checkpointIndex] = elapsed;

      return {
        sectorSplitsMs: [...state.sectorSplitsMs, elapsed],
        nextCheckpointIndex: state.nextCheckpointIndex + 1,
        bestSectorTimesMs,
        lastSectorDelta:
          previousBest !== undefined
            ? { sectorIndex: checkpointIndex, deltaMs: elapsed - previousBest }
            : null,
      };
    }),

  completeLap: (now) =>
    set((state) => {
      if (state.lapStartTime === null) return state;
      const lapTimeMs = now - state.lapStartTime;
      const bestLapTimeMs =
        state.bestLapTimeMs === null || lapTimeMs < state.bestLapTimeMs
          ? lapTimeMs
          : state.bestLapTimeMs;

      return {
        lastLapTimeMs: lapTimeMs,
        bestLapTimeMs,
        lapHistoryMs: [...state.lapHistoryMs, lapTimeMs],
        // Immediately start the next lap — crossing start/finish both ends
        // the previous lap and begins the next one on a closed circuit.
        lapStartTime: now,
        nextCheckpointIndex: 0,
        sectorSplitsMs: [],
      };
    }),

  clearSectorDelta: () => set({ lastSectorDelta: null }),
}));
