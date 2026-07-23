"use client";

import { RigidBody, CylinderCollider, type RapierRigidBody } from "@react-three/rapier";
import { useTrackStore } from "@/store/track-store";
import {
  isPropType,
  PROP_BLOCKING_RADIUS,
  PROP_COLLIDER_HEIGHT,
  PROP_DYNAMIC,
  PROP_HAS_COLLIDER,
} from "@/modules/objects/prop-registry";
import { placedObjectHandles } from "./placed-object-registry";

// Registers this body's handle so Vehicle's collision handler can tell "hit
// an object" apart from routine road/terrain contact -- both are just Rapier
// collisions from the vehicle's point of view, but only one should ever
// trigger the crash sound. React 19 supports cleanup functions returned from
// callback refs, so this doubles as the unregister on unmount.
function registerPlacedObjectBody(body: RapierRigidBody | null) {
  if (!body) return;
  placedObjectHandles.add(body.handle);
  return () => {
    placedObjectHandles.delete(body.handle);
  };
}

// One RigidBody per placed object -- PlacedObjects (scene/) stays purely
// visual (PROJECT_PLAN.md §4: presentational only, shared between edit/play),
// this is the play-mode-only physics half, same split TrackPhysics already
// uses for the road/terrain. A cylinder collider rather than a box for the
// same reason the vehicle's collider is rounded (see Vehicle) -- a car
// grazing a round footprint deflects smoothly, a box corner catches it.
//
// object.position.y is the object's ground-contact point (PlacedObjects
// renders its group at exactly that position with parts offset upward from
// it), so each body sits at halfHeight above it to put the collider's base
// on the ground rather than centered through it. Collider shape ignores the
// object's own yaw (a cylinder is rotationally symmetric, so it wouldn't
// change anything) -- deliberately not a full quaternion, not an oversight.
//
// position as a JSX prop (rather than the imperative mount-only pattern
// Vehicle uses) is safe here specifically because it never re-renders during
// a play session: `objects` only changes when the document is edited, which
// doesn't happen in Play mode, so there's no repeated re-application to fight
// a knocked cone's accumulated physics motion the way Vehicle's spawn
// position once fought its own velocity.
export function ObjectPhysics() {
  const objects = useTrackStore((s) => s.document.objects);

  return (
    <>
      {objects.map((object) => {
        if (!isPropType(object.type)) return null;
        // forest/paddock (real Starter-Kit-Racing decoration tiles) are
        // purely visual backdrop dressing -- no runtime collider at all.
        // Editor-time validation still uses PROP_BLOCKING_RADIUS regardless
        // of this flag, so a decoration piece dropped across the road is
        // still flagged; it just doesn't also become an invisible wall.
        if (!PROP_HAS_COLLIDER[object.type]) return null;

        const radius = PROP_BLOCKING_RADIUS[object.type] * object.scale.x;
        const halfHeight = (PROP_COLLIDER_HEIGHT[object.type] * object.scale.y) / 2;
        const dynamic = PROP_DYNAMIC[object.type];

        return (
          <RigidBody
            key={object.id}
            ref={registerPlacedObjectBody}
            type={dynamic ? "dynamic" : "fixed"}
            colliders={false}
            position={[object.position.x, object.position.y + halfHeight, object.position.z]}
            rotation={[0, 0, 0]}
            mass={dynamic ? 8 : undefined}
            linearDamping={dynamic ? 0.6 : undefined}
            angularDamping={dynamic ? 0.6 : undefined}
          >
            <CylinderCollider args={[halfHeight, radius]} friction={0.7} restitution={0.15} />
          </RigidBody>
        );
      })}
    </>
  );
}
