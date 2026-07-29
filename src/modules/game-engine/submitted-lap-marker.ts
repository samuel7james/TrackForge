// Remembers that the leaderboard once accepted a time from this browser
// for a given track layout.
//
// Without it, "the server has no record for you" is ambiguous: it's also
// true for someone who only ever tested the track in the editor (those
// sessions never submit), and for anyone whose submission failed on the
// network. Clearing a ghost on that signal alone would throw away laps
// that were never on the leaderboard to begin with.
//
// With it, the pairing is unambiguous -- a record existed, and now doesn't,
// so it was deleted -- which is the only case the ghost should be dropped
// for. Keyed by layout fingerprint alongside trackId for the same reason
// the ghost and best-lap keys are: an edited track is a different race.
const STORAGE_PREFIX = "racing.submitted.";

function storageKey(trackId: string | null, cellsFingerprint: string): string {
  return STORAGE_PREFIX + (trackId || "default") + "." + cellsFingerprint;
}

export function markLapSubmitted(trackId: string | null, cellsFingerprint: string) {
  try {
    localStorage.setItem(storageKey(trackId, cellsFingerprint), "1");
  } catch {
    // storage unavailable -- the ghost just won't be auto-cleared later
  }
}

export function hasSubmittedLap(trackId: string | null, cellsFingerprint: string): boolean {
  try {
    return localStorage.getItem(storageKey(trackId, cellsFingerprint)) !== null;
  } catch {
    return false;
  }
}

export function clearSubmittedLapMark(trackId: string | null, cellsFingerprint: string) {
  try {
    localStorage.removeItem(storageKey(trackId, cellsFingerprint));
  } catch {
    // storage unavailable -- nothing to clear
  }
}
