// Plain mutable object (same pattern as vehicle-ref.ts) — the controller
// writes into it every physics frame, CarModel reads from it in its own
// useFrame to drive purely cosmetic animation (lean, wheel spin/steer)
// without round-tripping through React state at 60fps.
export const vehicleVisualState = {
  forwardSpeed: 0,
  steerInput: 0,
  throttleInput: 0,
  // Sideways speed the grip model damped out this frame, before correction --
  // a stand-in "how hard is this car sliding" metric for the skid sound
  // (GameAudio.update's driftIntensity), read the same way CarModel already
  // reads this object: written every physics step, read once per render.
  lateralSlip: 0,
};
