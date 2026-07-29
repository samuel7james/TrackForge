// Runtime multipliers over the vehicle's two headline physics constants
// (see vehicle.ts). A plain module singleton rather than store/React state:
// Vehicle.update reads these every frame from outside React entirely, and a
// value edited here has to take effect on the very next frame with no
// re-render or engine restart in between.
//
// Defaults are all 1, i.e. exactly the stock handling -- nothing reads
// differently until something writes to it. Values persist for the whole
// page session (module scope), so they survive leaving and re-entering play
// mode, and reset on a full reload.
export const tuning = {
  /** Scales MAX_SPEED: the speed sustained full throttle converges toward. */
  speedScale: 1,
  /** Scales THROTTLE_ACCEL_RATE: how hard the throttle pulls toward that
   * speed, i.e. how quickly it gets there rather than how fast it ends up. */
  accelScale: 1,
};

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export function resetTuning() {
  tuning.speedScale = 1;
  tuning.accelScale = 1;
}
