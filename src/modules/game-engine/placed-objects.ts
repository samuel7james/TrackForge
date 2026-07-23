// Renders/colliders for TrackForge's own placed-object system (cones,
// barriers, trees, rocks, flags, forest patches, paddocks) on top of the
// vendored tile-based track -- a genuine TrackForge feature the reference
// doesn't have at all. Reuses `prop-registry.ts` unmodified: it was already
// pure Three.js/data (BufferGeometry/Material, no React coupling), so the
// same registry that drove the old R3F `<Instances>` rendering path works
// here too, just added to the scene imperatively instead of through the
// fiber reconciler.
import * as THREE from "three";
import { rigidBody, cylinder, MotionType, type World, type RigidBody } from "crashcat";
import {
  PROP_REGISTRY,
  PROP_HAS_COLLIDER,
  PROP_BLOCKING_RADIUS,
  PROP_COLLIDER_HEIGHT,
  PROP_DYNAMIC,
  isPropType,
} from "@/modules/objects/prop-registry";
import type { PlacedObject } from "@/modules/track-format/schema";
import type { ModelMap } from "./track";

function modelKeyFromUrl(modelUrl: string): string {
  const file = modelUrl.split("/").pop() ?? "";
  return file.replace(/\.glb$/, "");
}

// Builds one child group per placed object (procedural parts cloned as
// meshes, or the shared GLTF scene cloned for forest/paddock) and adds them
// all under a single returned group, so the whole layer can be removed in
// one `scene.remove()` on dispose.
export function buildPlacedObjectMeshes(scene: THREE.Scene, models: ModelMap, objects: PlacedObject[]): THREE.Group {
  const group = new THREE.Group();

  for (const object of objects) {
    if (!isPropType(object.type)) continue;
    const definition = PROP_REGISTRY[object.type];

    const objectGroup = new THREE.Group();
    objectGroup.position.set(object.position.x, object.position.y, object.position.z);
    objectGroup.quaternion.set(object.rotation.x, object.rotation.y, object.rotation.z, object.rotation.w);
    objectGroup.scale.set(object.scale.x, object.scale.y, object.scale.z);

    if (definition.modelUrl) {
      const src = models[modelKeyFromUrl(definition.modelUrl)];
      if (src) {
        const cloned = src.clone(true);
        cloned.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        objectGroup.add(cloned);
      }
    } else {
      for (const part of definition.parts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.position.set(part.localPosition[0], part.localPosition[1], part.localPosition[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // PROP_REGISTRY's procedural geometries/materials are module-level
        // singletons, built once at import time and shared by every placed
        // instance across every engine mount in this browser tab -- not
        // per-instance clones. engine-core.ts's generic scene-teardown sweep
        // (disposeObject3D) checks this flag and skips these specifically,
        // since disposing a shared singleton on one engine's teardown would
        // permanently break it (its GPU buffer freed) for every future mount
        // that reuses the same registry.
        mesh.userData.sharedResource = true;
        objectGroup.add(mesh);
      }
    }

    group.add(objectGroup);
  }

  scene.add(group);
  return group;
}

// One crashcat rigid body per collidable placed object -- same "cylinder
// footprint at the object's ground-contact point" pattern the old Rapier
// version (object-physics.tsx) used, same registry flags deciding
// static-vs-dynamic (only cones knock around) and which prop types get a
// body at all (forest/paddock are decorative backdrop, not obstacles).
export function buildPlacedObjectBodies(
  world: World,
  objectLayerStatic: number,
  objectLayerMoving: number,
  objects: PlacedObject[]
): RigidBody[] {
  const bodies: RigidBody[] = [];

  for (const object of objects) {
    if (!isPropType(object.type)) continue;
    if (!PROP_HAS_COLLIDER[object.type]) continue;

    const radius = PROP_BLOCKING_RADIUS[object.type] * object.scale.x;
    const halfHeight = (PROP_COLLIDER_HEIGHT[object.type] * object.scale.y) / 2;
    const dynamic = PROP_DYNAMIC[object.type];

    const body = rigidBody.create(world, {
      shape: cylinder.create({ radius, halfHeight }),
      motionType: dynamic ? MotionType.DYNAMIC : MotionType.STATIC,
      objectLayer: dynamic ? objectLayerMoving : objectLayerStatic,
      position: [object.position.x, object.position.y + halfHeight, object.position.z],
      mass: dynamic ? 8 : undefined,
      friction: 0.7,
      restitution: 0.15,
      linearDamping: dynamic ? 0.6 : undefined,
      angularDamping: dynamic ? 0.6 : undefined,
    });

    bodies.push(body);
  }

  return bodies;
}
