// Persists/loads a recorded best-lap ghost (see ghost-recorder.ts) and
// replays it by interpolating between the two samples bracketing the
// current lap time -- the ~15Hz recording rate is far coarser than the
// 60fps render loop, so playback would look choppy without this.
import * as THREE from "three";
import type { GhostSample } from "./ghost-recorder";

const STORAGE_PREFIX = "racing.bestGhost.";

// `cellsFingerprint` (encodeCells' output, see engine-core.ts) is folded
// into the key alongside trackId -- a ghost recorded on a track's previous
// layout would otherwise keep replaying after the owner edits it, driving
// a route that no longer matches what's actually built.
function storageKey(trackId: string | null, cellsFingerprint: string): string {
  return STORAGE_PREFIX + (trackId || "default") + "." + cellsFingerprint;
}

export function loadGhost(trackId: string | null, cellsFingerprint: string): GhostSample[] | null {
  try {
    const raw = localStorage.getItem(storageKey(trackId, cellsFingerprint));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGhost(trackId: string | null, cellsFingerprint: string, samples: GhostSample[]) {
  try {
    if (samples.length === 0) return;
    localStorage.setItem(storageKey(trackId, cellsFingerprint), JSON.stringify(samples));
  } catch {
    // storage unavailable -- ghost just won't persist
  }
}

// Used when the server reports this viewer no longer holds a lap record
// for the track (see engine-core.ts) -- the ghost is a replay of a time
// that has been taken off the leaderboard, so it shouldn't keep racing
// alongside as though it still stood.
export function clearGhost(trackId: string | null, cellsFingerprint: string) {
  try {
    localStorage.removeItem(storageKey(trackId, cellsFingerprint));
  } catch {
    // storage unavailable -- nothing to clear
  }
}

export interface GhostFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export class GhostPlayer {
  private samples: GhostSample[] | null;
  private searchIndex = 0;

  private readonly frame: GhostFrame = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };
  private readonly posA = new THREE.Vector3();
  private readonly posB = new THREE.Vector3();
  private readonly quatA = new THREE.Quaternion();
  private readonly quatB = new THREE.Quaternion();

  constructor(samples: GhostSample[] | null) {
    this.samples = samples;
  }

  get hasGhost(): boolean {
    return this.samples !== null;
  }

  setSamples(samples: GhostSample[]) {
    this.samples = samples;
    this.searchIndex = 0;
  }

  /** Returns the interpolated transform at `lapTime`, or null if there's no
   * ghost loaded or the ghost's recording has already finished (its own
   * best lap ended before `lapTime`). */
  sampleAt(lapTime: number): GhostFrame | null {
    const samples = this.samples;
    if (!samples || samples.length === 0) return null;

    const last = samples[samples.length - 1];
    if (lapTime > last[0]) return null;
    if (lapTime <= samples[0][0]) {
      this.applySample(samples[0]);
      return this.frame;
    }

    if (this.searchIndex >= samples.length - 1 || samples[this.searchIndex][0] > lapTime) {
      this.searchIndex = 0;
    }
    while (
      this.searchIndex < samples.length - 2 &&
      samples[this.searchIndex + 1][0] < lapTime
    ) {
      this.searchIndex += 1;
    }

    const a = samples[this.searchIndex];
    const b = samples[this.searchIndex + 1];
    const span = b[0] - a[0];
    const t = span > 0 ? (lapTime - a[0]) / span : 0;

    this.posA.set(a[1], a[2], a[3]);
    this.posB.set(b[1], b[2], b[3]);
    this.frame.position.lerpVectors(this.posA, this.posB, t);

    this.quatA.set(a[4], a[5], a[6], a[7]);
    this.quatB.set(b[4], b[5], b[6], b[7]);
    this.frame.quaternion.copy(this.quatA).slerp(this.quatB, t);

    return this.frame;
  }

  private applySample(s: GhostSample) {
    this.frame.position.set(s[1], s[2], s[3]);
    this.frame.quaternion.set(s[4], s[5], s[6], s[7]);
  }
}
