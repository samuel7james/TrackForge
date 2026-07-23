// Set of Rapier rigid-body handles for placed objects (props), populated by
// ObjectPhysics and checked by Vehicle's collision handler to tell "hit a
// prop" apart from routine road/terrain contact.
//
// Not the RigidBody `name` prop -- tried that first, and it silently didn't
// work: @react-three/rapier's collision payload's `rigidBodyObject` came back
// with an empty `.name` even though `name` isn't excluded from the props
// RigidBody spreads onto its underlying object3D, confirmed via direct
// payload inspection (logged every field, `.name` was `""` on both an actual
// object hit and routine ground contact). Rather than chase that further,
// handles are a lower-level identifier this component owns directly with no
// dependency on how a third-party component happens to forward one more
// prop. Each Play session creates a fresh Rapier world (ModeController fully
// unmounts/remounts `<Physics>` on edit/play switch), and per-object RigidBody
// ref callbacks add on mount / remove on unmount, so entries never survive
// past the session that created them.
export const placedObjectHandles = new Set<number>();
