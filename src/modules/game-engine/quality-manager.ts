import * as THREE from "three";

// Render quality was previously a single decision made once, from
// `"ontouchstart" in window`: every touch device got the stripped-back
// settings and every desktop got the full ones. That maps badly onto real
// hardware in both directions -- a current flagship phone renders this
// scene comfortably and was being held at half resolution with no shadows
// for no reason, while a weak integrated-graphics laptop was handed the
// expensive path and left to chug.
//
// This measures what the machine in front of it can actually sustain and
// moves between quality levels to hold the frame rate, so "looks good" and
// "runs fast" stop being a guess about device class.
//
// Only the two settings that can genuinely change after the renderer
// exists are driven here: pixel ratio (free to change any frame) and
// shadows (one material recompile). MSAA and the HDR framebuffer are fixed
// at construction and can't be revisited without rebuilding the whole
// renderer, which would drop the WebGL context mid-drive.

/** Below this, drop quality: enough headroom under 60 to react before it's
 * visibly stuttering rather than after. */
const FPS_DEMOTE = 50;
/** Above this, consider climbing. The gap from FPS_DEMOTE is the
 * hysteresis band that stops a device sitting exactly on the boundary from
 * oscillating between levels every second. */
const FPS_PROMOTE = 58;
/** Consecutive good seconds before stepping up. Deliberately slower to
 * promote than to demote -- an unnecessary demotion costs some sharpness,
 * an unnecessary promotion costs frames, which is what the player feels. */
const PROMOTE_STREAK = 3;

const DPR_STEP = 0.25;
const DPR_MIN = 0.75;

export class QualityManager {
  private renderer: THREE.WebGLRenderer;
  private dirLight: THREE.DirectionalLight;
  private scene: THREE.Scene;

  private dpr: number;
  private readonly maxDpr: number;
  shadowsEnabled: boolean;

  private frames = 0;
  private elapsed = 0;
  private goodStreak = 0;
  /** Sampling starts a beat late: the first seconds after mount include
   * model parsing, shader compilation and the light-probe bake, so frame
   * times there describe loading rather than steady-state rendering, and
   * would demote every device before it drew a single honest frame. */
  private warmup = 2;

  constructor(options: {
    renderer: THREE.WebGLRenderer;
    dirLight: THREE.DirectionalLight;
    scene: THREE.Scene;
    /** Touch devices start conservative and climb once they've proven
     * themselves; desktops start at full quality and fall back only if
     * they actually struggle. Either way the measurements take over
     * within a few seconds. */
    startLow: boolean;
    maxDpr: number;
  }) {
    this.renderer = options.renderer;
    this.dirLight = options.dirLight;
    this.scene = options.scene;
    this.maxDpr = options.maxDpr;

    this.dpr = options.startLow ? Math.min(1.25, options.maxDpr) : options.maxDpr;
    this.shadowsEnabled = !options.startLow;
    this.applyDpr();
  }

  private applyDpr() {
    this.renderer.setPixelRatio(this.dpr);
    // Pixel ratio only takes effect once the drawing buffer is resized to
    // match it, so this has to follow every change.
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  private setShadows(enabled: boolean) {
    if (this.shadowsEnabled === enabled) return;
    this.shadowsEnabled = enabled;
    this.renderer.shadowMap.enabled = enabled;
    this.dirLight.castShadow = enabled;
    // Whether a material samples the shadow map is baked into its compiled
    // program, so every one of them has to be rebuilt for the change to
    // show up. Costs a hitch on the frame it happens, which is why this
    // fires at most a couple of times a session rather than per frame.
    this.scene.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) m.needsUpdate = true;
    });
  }

  /** Called once per rendered frame; acts at most once per second. */
  update(dt: number) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 1) return;

    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    if (this.warmup > 0) {
      this.warmup--;
      return;
    }

    if (fps < FPS_DEMOTE) {
      this.goodStreak = 0;
      // Resolution first: it's a continuous dial and recovers the most
      // frames per unit of visible quality lost. Shadows are the blunt
      // instrument, spent only once resolution has bottomed out.
      if (this.dpr > DPR_MIN) {
        this.dpr = Math.max(DPR_MIN, this.dpr - DPR_STEP);
        this.applyDpr();
      } else {
        this.setShadows(false);
      }
      return;
    }

    if (fps < FPS_PROMOTE) {
      this.goodStreak = 0;
      return;
    }

    this.goodStreak++;
    if (this.goodStreak < PROMOTE_STREAK) return;
    this.goodStreak = 0;

    // Climb back in the reverse order it fell: resolution up to native
    // first, and only a device holding the frame rate at full resolution
    // has earned the shadow pass.
    if (this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + DPR_STEP);
      this.applyDpr();
    } else {
      this.setShadows(true);
    }
  }
}
