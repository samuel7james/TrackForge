// Vendored from mrdoob/Starter-Kit-Racing (js/Controls.js, MIT license).
// Ported to TypeScript -- see public/models/THIRD_PARTY_NOTICES.md.
//
// Keyboard/gamepad/touch input, unified into one steer/throttle pair per
// frame. The touch joystick is still raw injected DOM here (matching the
// original) -- Phase 2 of the engine-swap work replaces it with a themed
// React overlay reading the same touchDirX/touchDirY/touchActive fields;
// this phase only adds `dispose()` so the listeners/DOM don't leak across a
// React mount/unmount cycle, since the original assumes it owns the page
// forever.
export interface ControlsState {
  x: number;
  z: number;
  touchActive: boolean;
}

export class Controls {
  private keys: Record<string, boolean> = {};
  x = 0;
  z = 0;

  touchActive = false;
  touchDirX = 0;
  touchDirY = 0;
  private steerPointerId: number | null = null;
  private steerStartX = 0;
  private steerStartY = 0;

  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private touchStyleEl: HTMLStyleElement | null = null;
  private touchContainerEl: HTMLDivElement | null = null;

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => (this.keys[e.code] = true);
    this.handleKeyUp = (e: KeyboardEvent) => (this.keys[e.code] = false);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    this.setupTouchUI();
  }

  private setupTouchUI() {
    if (!("ontouchstart" in window)) return;

    const css = document.createElement("style");
    css.textContent = `
			.touch-controls { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
			.steer-zone { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
			.steer-base { position: absolute; width: 140px; height: 140px; margin: -70px 0 0 -70px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); display: none; }
			.steer-knob { position: absolute; top: 50%; left: 50%; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; background: rgba(255,255,255,0.35); }
		`;
    document.head.appendChild(css);
    this.touchStyleEl = css;

    const container = document.createElement("div");
    container.className = "touch-controls";

    const steerZone = document.createElement("div");
    steerZone.className = "steer-zone";

    const base = document.createElement("div");
    base.className = "steer-base";
    const knob = document.createElement("div");
    knob.className = "steer-knob";
    base.appendChild(knob);
    steerZone.appendChild(base);

    container.appendChild(steerZone);
    document.body.appendChild(container);
    this.touchContainerEl = container;

    const steerRange = 40;

    steerZone.addEventListener("pointerdown", (e) => {
      if (this.steerPointerId !== null) return;
      steerZone.setPointerCapture(e.pointerId);
      this.steerPointerId = e.pointerId;
      this.steerStartX = e.clientX;
      this.steerStartY = e.clientY;
      this.touchActive = true;
      this.touchDirX = 0;
      this.touchDirY = 0;
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      base.style.display = "block";
    });

    steerZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.steerPointerId) return;
      let dx = (e.clientX - this.steerStartX) / steerRange;
      let dy = (e.clientY - this.steerStartY) / steerRange;
      const mag = Math.sqrt(dx * dx + dy * dy);

      if (mag > 1) {
        dx /= mag;
        dy /= mag;
      }

      this.touchDirX = dx;
      this.touchDirY = dy;
      knob.style.transform = `translate(${this.touchDirX * 60}px, ${this.touchDirY * 60}px)`;
    });

    const endSteer = (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointerId) return;
      this.steerPointerId = null;
      this.touchActive = false;
      this.touchDirX = 0;
      this.touchDirY = 0;
      knob.style.transform = "";
      base.style.display = "none";
    };

    steerZone.addEventListener("pointerup", endSteer);
    steerZone.addEventListener("pointercancel", endSteer);
  }

  update(): ControlsState {
    let x = 0,
      z = 0;

    // Keyboard

    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) x -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) x += 1;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) z += 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) z -= 1;

    // Gamepad

    const gamepads = navigator.getGamepads();

    for (const gp of gamepads) {
      if (!gp) continue;

      const stickX = gp.axes[0];
      if (Math.abs(stickX) > 0.15) x = stickX;

      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      const lt = gp.buttons[6] ? gp.buttons[6].value : 0;

      if (rt > 0.1 || lt > 0.1) z = rt - lt;

      break;
    }

    // Touch — joystick mapped to world space (camera is 45° azimuth)

    if (this.touchActive) {
      const jx = this.touchDirX;
      const jy = this.touchDirY;
      const mag = Math.sqrt(jx * jx + jy * jy);

      if (mag > 0.15) {
        x = ((jx + jy) * Math.SQRT1_2) / mag;
        z = ((-jx + jy) * Math.SQRT1_2) / mag;
      }
    }

    this.x = x;
    this.z = z;

    return { x, z, touchActive: this.touchActive };
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.touchContainerEl?.remove();
    this.touchStyleEl?.remove();
  }
}
