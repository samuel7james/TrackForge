"use client";

import { useMemo } from "react";
import type * as THREE from "three";
import { Instance, Instances, useGLTF } from "@react-three/drei";
import { PROP_REGISTRY, isPropType } from "./prop-registry";
import type { PlacedObject } from "@/modules/track-format/schema";
import type { PropType } from "./prop-registry";

// Presentational only -- shared unchanged between edit and play mode
// (scene-root.tsx passes the current track-store objects in; the real
// vendored engine's own placed-objects.ts, a different file, renders these
// imperatively for Play instead of through this component). One <Instances>
// pool per (prop type, part) pair so every cone's base, every tree's trunk,
// etc. batches into a single draw call regardless of how many are placed;
// each object's own position/rotation/scale is just an ordinary nested
// <group> around its parts' <Instance>s, composed on top of the shared
// per-part geometry. Editing interaction (place/select/drag) lives in the
// separate tile-grid-layer.tsx, not here.
export function PlacedObjects({ objects }: { objects: PlacedObject[] }) {
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

// GLTF-based props (forest/paddock decoration tiles) render one
// <primitive> per placed object rather than drei's
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
