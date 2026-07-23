// Vendored from mrdoob/Starter-Kit-Racing (js/LapTimer.js, MIT license).
// Ported to TypeScript -- see public/models/THIRD_PARTY_NOTICES.md.
//
// Tracks lap completion by requiring the car to visit every non-finish cell
// at least once, then cross the finish line moving forward -- not just
// "crossed the line," which would let a car ping-pong across it for free
// laps. Still builds its own raw DOM HUD here (buildUI()); Phase 2 of the
// engine-swap work replaces this with a themed React overlay reading the
// same lap/currentLapTime/bestLap/lastLap fields, mirroring the plain-
// mutable-state pattern TrackForge's own vehicle-visual-state.ts already
// uses. `dispose()` is a TrackForge addition for clean unmount.
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

function formatTime(t: number | null | undefined): string {
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
  private running = false;

  private lineCenter = new THREE.Vector3();
  private lineForward = new THREE.Vector3(0, 0, 1);
  private lineRight = new THREE.Vector3(1, 0, 0);

  private prevForwardProj: number | null = null;

  private cellSize: number;
  private requiredCells = new Set<string>();
  private visitedCells = new Set<string>();

  private enabled: boolean;

  private lapEl: HTMLElement | null = null;
  private currentEl: HTMLElement | null = null;
  private lastEl: HTMLElement | null = null;
  private bestEl: HTMLElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private rootEl: HTMLElement | null = null;

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

      this.buildUI();
    }
  }

  private buildUI() {
    const style = document.createElement("style");
    style.textContent = `
			#lap-timer {
				position: absolute;
				top: 12px;
				left: 12px;
				color: #fff;
				font: 600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				background: rgba(0,0,0,0.5);
				padding: 10px 14px;
				border-radius: 10px;
				line-height: 1.4;
				text-shadow: 0 1px 2px rgba(0,0,0,0.6);
				user-select: none;
				pointer-events: none;
				z-index: 10;
				min-width: 140px;
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
			}
			#lap-timer .row { display: flex; justify-content: space-between; gap: 12px; }
			#lap-timer .label { opacity: 0.65; font-weight: 500; letter-spacing: 0.06em; }
			#lap-timer .current { font: 700 24px/1.1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; margin: 4px 0 6px; }
			#lap-timer .stat { font-size: 12px; font-variant-numeric: tabular-nums; opacity: 0.9; }
		`;
    document.head.appendChild(style);
    this.styleEl = style;

    const placeholder = formatTime(null);
    const el = document.createElement("div");
    el.id = "lap-timer";
    el.innerHTML =
      '<div class="row"><span class="label">LAP</span><span class="lap">1</span></div>' +
      `<div class="current">${placeholder}</div>` +
      `<div class="row stat"><span class="label">LAST</span><span class="last">${placeholder}</span></div>` +
      `<div class="row stat"><span class="label">BEST</span><span class="best">${formatTime(this.bestLap)}</span></div>`;
    document.body.appendChild(el);
    this.rootEl = el;

    this.lapEl = el.querySelector(".lap");
    this.currentEl = el.querySelector(".current");
    this.lastEl = el.querySelector(".last");
    this.bestEl = el.querySelector(".best");
  }

  update(dt: number, position: THREE.Vector3, hasInput: boolean) {
    if (!this.enabled) return;
    if (!this.running && !hasInput) return;
    this.running = true;

    this.currentLapTime += dt;
    if (this.currentEl) this.currentEl.textContent = formatTime(this.currentLapTime);

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
    if (isBest) {
      this.bestLap = this.currentLapTime;
      saveBest(this.storageKey, this.bestLap);
    }
    this.lap += 1;
    this.currentLapTime = 0;

    if (this.lapEl) this.lapEl.textContent = String(this.lap);
    if (this.lastEl) this.lastEl.textContent = formatTime(this.lastLap);
    if (this.bestEl) this.bestEl.textContent = formatTime(this.bestLap);

    const color = isBest ? "#5af168" : "#ff6e6e";
    this.currentEl?.animate([{ color }, { color }, { color: "#fff" }], { duration: 1200, easing: "ease-out" });
  }

  dispose() {
    this.rootEl?.remove();
    this.styleEl?.remove();
  }
}
