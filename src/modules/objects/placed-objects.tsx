"use client";

import { useMemo } from "react";
import { Instance, Instances } from "@react-three/drei";
import { useTrackStore } from "@/store/track-store";
import { PROP_REGISTRY, isPropType } from "./prop-registry";
import type { PlacedObject } from "@/modules/track-format/schema";
import type { PropType } from "./prop-registry";

// Presentational only -- shared unchanged between edit and play mode, like
// Road and Terrain (PROJECT_PLAN.md §4). One <Instances> pool per (prop
// type, part) pair so every cone's base, every tree's trunk, etc. batches
// into a single draw call regardless of how many are placed; each object's
// own position/rotation/scale is just an ordinary nested <group> around its
// parts' <Instance>s, composed on top of the shared per-part geometry.
// Editing interaction (place/select/drag) lives in the separate, editor-only
// ObjectPlacementLayer, not here.
export function PlacedObjects() {
  const objects = useTrackStore((s) => s.document.objects);

  const byType = useMemo(() => {
    const groups = new Map<PropType, PlacedObject[]>();
    for (const object of objects) {
      if (!isPropType(object.type)) continue;
      const list = groups.get(object.type);
      if (list) list.push(object);
      else groups.set(object.type, [object]);
    }
    return groups;
  }, [objects]);

  return (
    <>
      {Array.from(byType.entries()).map(([type, objs]) => (
        <PropTypeInstances key={type} type={type} objects={objs} />
      ))}
    </>
  );
}

function PropTypeInstances({ type, objects }: { type: PropType; objects: PlacedObject[] }) {
  const definition = PROP_REGISTRY[type];
  return (
    <>
      {definition.parts.map((part, partIndex) => (
        <Instances key={partIndex} geometry={part.geometry} material={part.material} castShadow receiveShadow>
          {objects.map((object) => (
            <group
              key={object.id}
              position={[object.position.x, object.position.y, object.position.z]}
              quaternion={[object.rotation.x, object.rotation.y, object.rotation.z, object.rotation.w]}
              scale={[object.scale.x, object.scale.y, object.scale.z]}
            >
              <Instance position={part.localPosition} />
            </group>
          ))}
        </Instances>
      ))}
    </>
  );
}
