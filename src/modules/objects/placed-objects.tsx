"use client";

import { useMemo } from "react";
import type * as THREE from "three";
import { Instance, Instances, useGLTF } from "@react-three/drei";
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
//
// `objects` is optional and defaults to the v1 store -- the new tile-based
// editor (scene-root-v2.tsx) passes its own v2 store's objects explicitly
// instead, reusing this same instancing logic rather than duplicating ~100
// lines of it for one differing line (which store to read from).
export function PlacedObjects({ objects: objectsProp }: { objects?: PlacedObject[] } = {}) {
  const storeObjects = useTrackStore((s) => s.document.objects);
  const objects = objectsProp ?? storeObjects;

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
      {Array.from(byType.entries()).map(([type, objs]) =>
        PROP_REGISTRY[type].modelUrl ? (
          <GltfPropInstances key={type} type={type} objects={objs} />
        ) : (
          <PropTypeInstances key={type} type={type} objects={objs} />
        )
      )}
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

// GLTF-based props (forest/paddock -- real Starter-Kit-Racing decoration
// tiles) render one <primitive> per placed object rather than drei's
// <Instances> -- these are whole scenic clusters, not simple repeated
// primitives, and are placed far less densely than cones/trees, so the
// instancing win matters less than just reusing the loaded scene directly.
// useGLTF's cache means every instance shares one parsed scene; each needs
// its own clone since a THREE.Object3D can only live in one place in the
// live scene graph at a time.
function GltfPropInstances({ type, objects }: { type: PropType; objects: PlacedObject[] }) {
  const modelUrl = PROP_REGISTRY[type].modelUrl!;
  const { scene } = useGLTF(modelUrl);

  return (
    <>
      {objects.map((object) => (
        <GltfPropInstance key={object.id} scene={scene} object={object} />
      ))}
    </>
  );
}

function GltfPropInstance({
  scene,
  object,
}: {
  scene: THREE.Object3D;
  object: PlacedObject;
}) {
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  return (
    <group
      position={[object.position.x, object.position.y, object.position.z]}
      quaternion={[object.rotation.x, object.rotation.y, object.rotation.z, object.rotation.w]}
      scale={[object.scale.x, object.scale.y, object.scale.z]}
    >
      <primitive object={cloned} />
    </group>
  );
}
