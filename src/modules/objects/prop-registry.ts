import * as THREE from "three";
import { Gem, TrafficCone, TreePine, Flag, Construction } from "lucide-react";
import type { ComponentType } from "react";
import type { PlacedObject } from "@/modules/track-format/schema";

export type PropType = "cone" | "barrier" | "tree" | "rock" | "flag";

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
  parts: PropPart[];
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
};

export const PROP_TYPES = Object.keys(PROP_REGISTRY) as PropType[];

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
