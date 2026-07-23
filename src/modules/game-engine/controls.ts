// Vendored from mrdoob/Starter-Kit-Racing (js/Controls.js, MIT license).
// Ported to TypeScript -- see public/models/THIRD_PARTY_NOTICES.md.
//
// Keyboard/gamepad/touch input, unified into one steer/throttle pair per
// frame. Pure input state, no DOM: the touch joystick's pointer-math lives
// here as public methods (handleSteerStart/Move/End), but drawing the
// joystick itself is touch-controls-overlay.tsx's job -- it forwards
// pointer events into these methods and reads touchDirX/touchDirY/
// touchActive back out to position the knob, the same split lap-timer.ts
// uses (this class owns the state, a React component owns the pixels).
export interface ControlsState {
  x: number;
  z: number;
  touchActive: boolean;
}

const STEER_RANGE = 40;

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

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => (this.keys[e.code] = true);
    this.handleKeyUp = (e: KeyboardEvent) => (this.keys[e.code] = false);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  handleSteerStart(pointerId: number, clientX: number, clientY: number) {
    if (this.steerPointerId !== null) return;
    this.steerPointerId = pointerId;
    this.steerStartX = clientX;
    this.steerStartY = clientY;
    this.touchActive = true;
    this.touchDirX = 0;
    this.touchDirY = 0;
  }

  handleSteerMove(pointerId: number, clientX: number, clientY: number) {
    if (pointerId !== this.steerPointerId) return;
    let dx = (clientX - this.steerStartX) / STEER_RANGE;
    let dy = (clientY - this.steerStartY) / STEER_RANGE;
    const mag = Math.sqrt(dx * dx + dy * dy);

    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    this.touchDirX = dx;
    this.touchDirY = dy;
  }

  handleSteerEnd(pointerId: number) {
    if (pointerId !== this.steerPointerId) return;
    this.steerPointerId = null;
    this.touchActive = false;
    this.touchDirX = 0;
    this.touchDirY = 0;
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
  }
}
