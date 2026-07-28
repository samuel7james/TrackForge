// Keyboard/gamepad/touch input, unified into one steer/throttle pair per
// frame. Pure input state, no DOM: touch-controls-overlay.tsx just calls
// setTouchLeft/Right/Brake in response to its own button press/release
// events, the same split lap-timer.ts uses (this class owns the state, a
// React component owns the pixels).
export interface ControlsState {
  x: number;
  z: number;
  touchActive: boolean;
}

export class Controls {
  private keys: Record<string, boolean> = {};
  x = 0;
  z = 0;

  // Touch: left/right buttons steer (mapped straight to the car's own
  // relative left/right, same as keyboard -- unlike the old joystick, which
  // mapped a drag direction onto world-space axes assuming a fixed camera
  // angle. That assumption broke once mobile got its own heading-relative
  // chase camera, and reportedly felt inverted even before that -- routing
  // touch through the exact same x/z the keyboard branch already uses
  // sidesteps needing a second, separately-tuned steering model entirely).
  // Throttle is automatic for the whole session once autoThrottle is set
  // (there's no "gas" button); holding the brake button is the only manual
  // speed input, same lerp-toward-target-speed(-1) the keyboard's S/Down
  // already uses for braking-then-reverse.
  touchActive = false;
  touchLeft = false;
  touchRight = false;
  touchBrake = false;
  autoThrottle: boolean;

  // Starts true (not false) -- the engine's render loop can tick several
  // frames before React ever gets around to mounting start-countdown.tsx
  // and calling setFrozen(true) itself (createEngine's rAF loop starts
  // before its promise even resolves back to EngineMount, then there's a
  // state update + re-render + effect on top of that). On a touch session
  // autoThrottle is live from construction, so any of those early frames
  // would otherwise report real input, permanently latching LapTimer's
  // `running` flag true -- which is exactly why the timer (and the ghost,
  // which just samples the timer's elapsed time) were visibly running
  // before "GO" ever appeared. Defaulting to frozen here means there's no
  // window at all where an un-frozen frame can slip through before
  // start-countdown.tsx's effect explicitly un-freezes it.
  frozen = true;

  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;

  constructor(autoThrottle = false) {
    this.autoThrottle = autoThrottle;

    this.handleKeyDown = (e: KeyboardEvent) => (this.keys[e.code] = true);
    this.handleKeyUp = (e: KeyboardEvent) => (this.keys[e.code] = false);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  setTouchLeft(active: boolean) {
    this.touchLeft = active;
  }

  setTouchRight(active: boolean) {
    this.touchRight = active;
  }

  setTouchBrake(active: boolean) {
    this.touchBrake = active;
  }

  setFrozen(frozen: boolean) {
    this.frozen = frozen;
  }

  update(): ControlsState {
    if (this.frozen) {
      this.x = 0;
      this.z = 0;
      return { x: 0, z: 0, touchActive: false };
    }

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

    // Touch: left/right steer, throttle automatic, brake on hold.
    if (this.autoThrottle) {
      if (this.touchLeft) x -= 1;
      if (this.touchRight) x += 1;
      z = this.touchBrake ? -1 : 1;
    }

    this.x = x;
    this.z = z;

    return { x, z, touchActive: this.autoThrottle };
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
