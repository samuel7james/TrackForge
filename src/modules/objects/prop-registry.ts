import * as THREE from "three";
import { Gem, TrafficCone, TreePine, Flag, Construction, Trees, Tent } from "lucide-react";
import type { ComponentType } from "react";
import type { PlacedObject } from "@/modules/track-format/schema";

export type PropType = "cone" | "barrier" | "tree" | "rock" | "flag" | "forest" | "paddock";

export interface PropPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  // Offset relative to the placed object's own transform -- e.g. tree
  // foliage sitting above the trunk. Composed with the object's position/
  // rotation/scale in PlacedObjects.tsx, not baked into the geometry itself,
  // so the same geometry+material pair is shared (and instanced) across
  // every placed instance of this prop type regardless of where its parts
  // end up in the world.
  localPosition: [number, number, number];
}

export interface PropDefinition {
  type: PropType;
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Procedural props (cone/barrier/tree/rock/flag) build parts from
  // primitives, same as SkyDome elsewhere in this codebase. `modelUrl`
  // props (forest/paddock decoration tiles) instead load a GLTF scene;
  // parts stays empty for those and PlacedObjects.tsx branches on modelUrl to
  // pick the rendering path. Two different asset pipelines under one
  // registry rather than forcing everything through primitives (these are
  // whole 10x10-unit scenic clusters, not something worth hand-modeling)
  // or forcing the simple props through a model-loading path they don't need.
  parts: PropPart[];
  modelUrl?: string;
}

function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
}

// Simple procedural shapes built from primitives -- consistent with the rest
// of the scene (CarModel, the road ribbon, SkyDome), no external model
// loading or asset pipeline needed for a first pass at object placement.
export const PROP_REGISTRY: Record<PropType, PropDefinition> = {
  cone: {
    type: "cone",
    label: "Cone",
    icon: TrafficCone,
    parts: [
      {
        geometry: new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16),
        material: material("#2b2b2b"),
        localPosition: [0, 0.025, 0],
      },
      {
        geometry: new THREE.ConeGeometry(0.3, 0.6, 16),
        material: material("#e8622c"),
        localPosition: [0, 0.35, 0],
      },
    ],
  },
  barrier: {
    type: "barrier",
    label: "Barrier",
    icon: Construction,
    parts: [
      {
        geometry: new THREE.BoxGeometry(2, 0.8, 0.5),
        material: material("#e8e8e8"),
        localPosition: [0, 0.4, 0],
      },
      {
        geometry: new THREE.BoxGeometry(2.05, 0.22, 0.52),
        material: material("#b3211f"),
        localPosition: [0, 0.62, 0],
      },
    ],
  },
  tree: {
    type: "tree",
    label: "Tree",
    icon: TreePine,
    parts: [
      {
        geometry: new THREE.CylinderGeometry(0.15, 0.22, 1.5, 8),
        material: material("#4a3b2c"),
        localPosition: [0, 0.75, 0],
      },
      {
        geometry: new THREE.ConeGeometry(1.1, 2.4, 10),
        material: material("#3d5a34"),
        localPosition: [0, 2.6, 0],
      },
    ],
  },
  rock: {
    type: "rock",
    label: "Rock",
    icon: Gem,
    parts: [
      {
        geometry: new THREE.IcosahedronGeometry(0.6, 0),
        material: material("#6b6b70"),
        localPosition: [0, 0.4, 0],
      },
    ],
  },
  flag: {
    type: "flag",
    label: "Flag",
    icon: Flag,
    parts: [
      {
        geometry: new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
        material: material("#3a3a3a"),
        localPosition: [0, 1.25, 0],
      },
      {
        geometry: new THREE.BoxGeometry(0.6, 0.4, 0.02),
        material: material("#c9302c"),
        localPosition: [0.32, 2.2, 0],
      },
    ],
  },
  forest: {
    type: "forest",
    label: "Forest patch",
    icon: Trees,
    parts: [],
    modelUrl: "/models/decoration-forest.glb",
  },
  paddock: {
    type: "paddock",
    label: "Paddock",
    icon: Tent,
    parts: [],
    modelUrl: "/models/decoration-tents.glb",
  },
};

export const PROP_TYPES = Object.keys(PROP_REGISTRY) as PropType[];

// Approximate ground-level footprint radius per prop type, used by track
// validation (Phase 16) to flag an object big/close enough to span the
// road and block the way through. Ground-level specifically -- a tree's
// wide canopy sits well above where a car's body would ever touch it, so
// this uses the trunk's radius, not the foliage's.
//
// forest/paddock are real 10x10-unit decoration tiles (measured from their
// own GLTF bounding box, see TASKS.md), not single objects -- their radius
// here is deliberately generous (half the tile footprint) so Phase 16's
// validation still catches one dropped squarely across the road, even
// though (see PROP_HAS_COLLIDER below) they don't get an actual physics
// collider at runtime.
export const PROP_BLOCKING_RADIUS: Record<PropType, number> = {
  cone: 0.35,
  barrier: 1.05,
  tree: 0.25,
  rock: 0.65,
  flag: 0.1,
  forest: 5,
  paddock: 5,
};

// Collider height per type -- ground-level footprint again (PROP_BLOCKING_RADIUS's
// comment applies here too), tall enough to actually stop a car's body, not tall
// enough to reach into a tree's canopy or a flag's cloth. Unused for
// forest/paddock (PROP_HAS_COLLIDER is false for both) but still given a
// real value rather than 0, since PROP_BLOCKING_RADIUS's validation-only use
// doesn't care but leaving a nonsensical height here would be confusing to
// a future reader who assumes every entry here is physics-meaningful.
export const PROP_COLLIDER_HEIGHT: Record<PropType, number> = {
  cone: 0.6,
  barrier: 0.85,
  tree: 1.6,
  rock: 0.7,
  flag: 2.4,
  forest: 4,
  paddock: 3,
};

// Which props are knockable (dynamic, low-mass rigid bodies the car can push
// around) vs. solid scenery (fixed, immovable). Only the cone is dynamic --
// a traffic cone getting knocked flying on contact is the classic arcade-
// racer feel this is chasing; a barrier/rock/tree/flag staying put keeps
// the "does this object block the path" validation meaningful -- a
// knockable obstacle can't really block anything.
export const PROP_DYNAMIC: Record<PropType, boolean> = {
  cone: true,
  barrier: false,
  tree: false,
  rock: false,
  flag: false,
  forest: false,
  paddock: false,
};

// Whether ObjectPhysics gives this prop type an actual runtime collider.
// forest/paddock are purely decorative backdrop dressing (the reference's
// own "decoration" naming/design intent -- scenery placed alongside the
// track, not obstacles on it), and at their real 10-unit footprint a
// physics collider would be far more likely to block the road unexpectedly
// than to add anything to the driving. Editor-time validation still uses
// PROP_BLOCKING_RADIUS above regardless of this flag, so an oversized
// decoration piece dropped on the road is still caught -- it just doesn't
// also become an invisible wall at runtime.
export const PROP_HAS_COLLIDER: Record<PropType, boolean> = {
  cone: true,
  barrier: true,
  tree: true,
  rock: true,
  flag: true,
  forest: false,
  paddock: false,
};

export function isPropType(type: string): type is PropType {
  return type in PROP_REGISTRY;
}

export function createPlacedObject(type: PropType, position: PlacedObject["position"]): PlacedObject {
  return {
    id: crypto.randomUUID(),
    type,
    position,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    groupId: null,
  };
}
