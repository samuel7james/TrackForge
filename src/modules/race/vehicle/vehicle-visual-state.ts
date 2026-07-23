// Plain mutable object (same pattern as vehicle-ref.ts) — the controller
// writes into it every physics frame, CarModel reads from it in its own
// useFrame to drive purely cosmetic animation (lean, wheel spin/steer)
// without round-tripping through React state at 60fps.
export const vehicleVisualState = {
  forwardSpeed: 0,
  steerInput: 0,
  throttleInput: 0,
  // Sideways speed the grip model damped out this frame, before correction --
  // raw m/s, kept around in case something wants the unscaled value.
  lateralSlip: 0,
  // lateralSlip normalized into the 0..2ish range GameAudio's skid thresholds
  // (and now DriftMarks/TireSmoke's own thresholds) expect -- computed once
  // in use-vehicle-controller.ts alongside lateralSlip so every consumer
  // (audio, tire marks, smoke) reads the same value instead of each
  // reimplementing the same scale-tuning constant.
  driftIntensity: 0,
};
