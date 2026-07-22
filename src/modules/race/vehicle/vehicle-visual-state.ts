// Plain mutable object (same pattern as vehicle-ref.ts) — the controller
// writes into it every physics frame, CarModel reads from it in its own
// useFrame to drive purely cosmetic animation (lean, wheel spin/steer)
// without round-tripping through React state at 60fps.
export const vehicleVisualState = {
  forwardSpeed: 0,
  steerInput: 0,
  throttleInput: 0,
};
