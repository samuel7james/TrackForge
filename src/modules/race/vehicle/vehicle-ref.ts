import type { RapierRigidBody } from "@react-three/rapier";

// Plain mutable handle (not React.createRef, whose `.current` is typed
// readonly) so the chase camera can read the vehicle's transform every
// frame without prop-drilling or a Zustand round-trip for something that
// never needs to trigger a React re-render.
export const vehicleHandle: { current: RapierRigidBody | null } = {
  current: null,
};
