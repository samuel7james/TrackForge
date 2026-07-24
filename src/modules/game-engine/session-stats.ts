// Per-session (never persisted) driving stats -- plain public fields, same
// style as LapTimer, so session-stats-panel.tsx can poll them every frame
// instead of this class building its own UI. Gated behind `enabled` the
// same way LapTimer gates behind `enabled` for a track with no finish
// line: no lap-based feature does anything without a lap timer to anchor it.
export interface LapHistoryEntry {
  lapNumber: number;
  timeMs: number;
  isBest: boolean;
}

export class SessionStats {
  enabled: boolean;

  topSpeedPct = 0;
  laps: LapHistoryEntry[] = [];

  private speedTimeAccum = 0;
  private timeAccum = 0;
  private nextLapNumber = 1;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  get avgSpeedPct(): number {
    return this.timeAccum > 0 ? this.speedTimeAccum / this.timeAccum : 0;
  }

  update(dt: number, speedFraction: number) {
    if (!this.enabled) return;

    const speedPct = Math.abs(speedFraction) * 100;
    this.topSpeedPct = Math.max(this.topSpeedPct, speedPct);
    this.speedTimeAccum += speedPct * dt;
    this.timeAccum += dt;
  }

  recordLap(timeMs: number, isBest: boolean) {
    if (!this.enabled) return;

    this.laps.push({ lapNumber: this.nextLapNumber, timeMs, isBest });
    this.nextLapNumber += 1;
  }
}
