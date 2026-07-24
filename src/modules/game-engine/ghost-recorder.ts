// Records the vehicle's world transform through a single lap attempt, at a
// capped sample rate (not every frame -- a 60fps recording would bloat
// localStorage for no perceptible playback benefit once interpolated).
// Samples are plain number tuples `[t, x, y, z, qx, qy, qz, qw]`, not
// THREE.Vector3/Quaternion instances, so the buffer round-trips through
// JSON.stringify for localStorage with zero conversion.
import * as THREE from "three";

export type GhostSample = [number, number, number, number, number, number, number, number];

const SAMPLE_INTERVAL = 1 / 15;

export class GhostRecorder {
  private samples: GhostSample[] = [];
  private lastSampleTime = -Infinity;

  record(lapTime: number, position: THREE.Vector3, quaternion: THREE.Quaternion) {
    if (lapTime - this.lastSampleTime < SAMPLE_INTERVAL) return;
    this.lastSampleTime = lapTime;
    this.samples.push([
      lapTime,
      position.x,
      position.y,
      position.z,
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w,
    ]);
  }

  reset() {
    this.samples = [];
    this.lastSampleTime = -Infinity;
  }

  getSamples(): GhostSample[] {
    return this.samples;
  }
}
