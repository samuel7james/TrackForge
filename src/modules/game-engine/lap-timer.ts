// Vendored from mrdoob/Starter-Kit-Racing (js/LapTimer.js, MIT license).
// Ported to TypeScript -- see public/models/THIRD_PARTY_NOTICES.md.
//
// Tracks lap completion by requiring the car to visit every non-finish cell
// at least once, then cross the finish line moving forward -- not just
// "crossed the line," which would let a car ping-pong across it for free
// laps. Pure state, no DOM: `lap`/`currentLapTime`/`lastLap`/`bestLap`/
// `lastLapWasBest` are plain public fields, same pattern TrackForge's own
// vehicle-visual-state.ts already uses -- hud-overlay.tsx reads them every
// frame instead of this class building its own UI, which the reference's
// original buildUI() did.
import * as THREE from "three";
import { CELL_RAW, GRID_SCALE, TRACK_CELLS, TYPE_NAMES, computeSpawnPosition, type Cell } from "./track";

const FINISH = TYPE_NAMES[3];
const STORAGE_PREFIX = "racing.bestLap.";
const _tmp = new THREE.Vector3();

function loadBest(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    const n = v !== null ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function saveBest(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable -- best lap just won't persist
  }
}

export function formatLapTime(t: number | null | undefined): string {
  if (t === null || t === undefined) return "0:00.00";

  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export class LapTimer {
  private storageKey: string;
  lap = 1;
  bestLap: number | null;
  lastLap: number | null = null;
  currentLapTime = 0;
  /** Whether the most recently completed lap was a new best -- read once by
   * the HUD alongside a `lap` change to decide the completion flash color. */
  lastLapWasBest = false;
  private running = false;

  private lineCenter = new THREE.Vector3();
  private lineForward = new THREE.Vector3(0, 0, 1);
  private lineRight = new THREE.Vector3(1, 0, 0);

  private prevForwardProj: number | null = null;

  private cellSize: number;
  private requiredCells = new Set<string>();
  private visitedCells = new Set<string>();

  /** Whether this track even has a finish line -- if not, lap tracking is a
   * no-op (matches the reference: a track with no finish cell never enables
   * the timer at all). */
  enabled: boolean;

  constructor(cells: Cell[] | null, trackId: string | null) {
    this.storageKey = STORAGE_PREFIX + (trackId || "default");
    this.bestLap = loadBest(this.storageKey);

    this.cellSize = CELL_RAW * GRID_SCALE;

    const list = cells || TRACK_CELLS;
    this.enabled = list.some((c) => c[2] === FINISH);

    if (this.enabled) {
      const spawn = computeSpawnPosition(list);
      this.lineCenter.set(spawn.position[0], 0, spawn.position[2]);
      this.lineForward.set(Math.sin(spawn.angle), 0, Math.cos(spawn.angle));
      this.lineRight.set(this.lineForward.z, 0, -this.lineForward.x);

      for (const c of list) {
        if (c[2] !== FINISH) this.requiredCells.add(c[0] + "," + c[1]);
      }
    }
  }

  update(dt: number, position: THREE.Vector3, hasInput: boolean) {
    if (!this.enabled) return;
    if (!this.running && !hasInput) return;
    this.running = true;

    this.currentLapTime += dt;

    const gx = Math.floor(position.x / this.cellSize);
    const gz = Math.floor(position.z / this.cellSize);
    const key = gx + "," + gz;
    if (this.requiredCells.has(key)) this.visitedCells.add(key);

    _tmp.copy(position).sub(this.lineCenter);
    const forwardProj = _tmp.dot(this.lineForward);
    const lateralProj = Math.abs(_tmp.dot(this.lineRight));

    if (this.prevForwardProj !== null) {
      const onLine = lateralProj <= this.cellSize * 0.5;
      const noTeleport = Math.abs(forwardProj - this.prevForwardProj) < 5;
      const crossedForward = this.prevForwardProj < 0 && forwardProj >= 0;

      if (onLine && noTeleport && crossedForward) {
        if (this.visitedCells.size === this.requiredCells.size) this.completeLap();
        this.visitedCells.clear();
      }
    }

    this.prevForwardProj = forwardProj;
  }

  private completeLap() {
    const isBest = this.bestLap === null || this.currentLapTime < this.bestLap;

    this.lastLap = this.currentLapTime;
    this.lastLapWasBest = isBest;
    if (isBest) {
      this.bestLap = this.currentLapTime;
      saveBest(this.storageKey, this.bestLap);
    }
    this.lap += 1;
    this.currentLapTime = 0;
  }
}
