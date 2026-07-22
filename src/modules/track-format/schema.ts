import { z } from "zod";

// The Track Document — see PROJECT_PLAN.md §7. Only `splines` is populated by
// the Milestone 1 UI; the rest of the shape exists now so later milestones
// (terrain, objects, checkpoints, validation) are additive, not migrations.

export const vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Vec3 = z.infer<typeof vec3Schema>;

export const quatSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});
export type Quat = z.infer<typeof quatSchema>;

export const difficultySchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const weatherSchema = z.enum([
  "sunny",
  "sunset",
  "night",
  "rain",
  "snow",
  "fog",
  "cloudy",
]);
export type Weather = z.infer<typeof weatherSchema>;

export const roadControlPointSchema = z.object({
  id: z.string(),
  position: vec3Schema,
  // "auto" derives tangentIn/tangentOut from neighboring points (Catmull-Rom
  // equivalent, via RoadCurve in modules/spline/road-curve.ts) every time the
  // spline changes; "manual" freezes them as authored vectors, editable via
  // the draggable tangent handles in TangentHandles.tsx (Phase 11).
  tangentMode: z.enum(["auto", "manual"]).default("auto"),
  tangentIn: vec3Schema,
  tangentOut: vec3Schema,
  width: z.number().positive(),
  banking: z.number(),
  elevation: z.number(),
});
export type RoadControlPoint = z.infer<typeof roadControlPointSchema>;

export const roadSplineSchema = z.object({
  id: z.string(),
  closed: z.boolean(),
  points: z.array(roadControlPointSchema),
});
export type RoadSpline = z.infer<typeof roadSplineSchema>;

export const terrainTextureLayerSchema = z.object({
  type: z.enum(["grass", "sand", "rock", "dirt", "snow"]),
  weightmap: z.array(z.number()),
});
export type TerrainTextureLayer = z.infer<typeof terrainTextureLayerSchema>;

export const terrainDataSchema = z.object({
  size: z.object({ width: z.number(), depth: z.number() }),
  resolution: z.number(),
  heightmap: z.array(z.number()),
  textureLayers: z.array(terrainTextureLayerSchema),
});
export type TerrainData = z.infer<typeof terrainDataSchema>;

export const placedObjectSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: vec3Schema,
  rotation: quatSchema,
  scale: vec3Schema,
  groupId: z.string().nullable(),
});
export type PlacedObject = z.infer<typeof placedObjectSchema>;

export const checkpointSchema = z.object({
  id: z.string(),
  position: vec3Schema,
  rotation: quatSchema,
  order: z.number(),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

export const validationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const trackDocumentSchema = z.object({
  formatVersion: z.literal(1),
  meta: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    authorId: z.string(),
    difficulty: difficultySchema,
    estimatedLapTimeMs: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  environment: z.object({
    weather: weatherSchema,
    timeOfDay: z.number(),
    fogDensity: z.number(),
  }),
  splines: z.array(roadSplineSchema),
  terrain: terrainDataSchema,
  objects: z.array(placedObjectSchema),
  checkpoints: z.array(checkpointSchema),
  startLine: z.object({ position: vec3Schema, rotation: quatSchema }),
  validation: z.object({
    isValid: z.boolean(),
    issues: z.array(validationIssueSchema),
    validatedAt: z.string().nullable(),
  }),
});
export type TrackDocument = z.infer<typeof trackDocumentSchema>;

const DEFAULT_ROAD_WIDTH = 8;

export function createControlPoint(position: Vec3): RoadControlPoint {
  return {
    id: crypto.randomUUID(),
    position,
    tangentMode: "auto",
    tangentIn: { x: 0, y: 0, z: 0 },
    tangentOut: { x: 0, y: 0, z: 0 },
    width: DEFAULT_ROAD_WIDTH,
    banking: 0,
    elevation: 0,
  };
}

export function createEmptyTrackDocument(name = "Untitled Track"): TrackDocument {
  const now = new Date().toISOString();
  return {
    formatVersion: 1,
    meta: {
      id: crypto.randomUUID(),
      slug: "",
      name,
      description: "",
      authorId: "",
      difficulty: "beginner",
      estimatedLapTimeMs: null,
      createdAt: now,
      updatedAt: now,
    },
    environment: { weather: "sunny", timeOfDay: 12, fogDensity: 0.02 },
    // Milestone 1 UI only ever manages a single spline, so it always exists
    // (even empty) rather than being lazily created — this keeps the Add/
    // Remove control point commands simple (see modules/editor/commands).
    splines: [{ id: crypto.randomUUID(), closed: false, points: [] }],
    terrain: {
      size: { width: 500, depth: 500 },
      resolution: 1,
      heightmap: [],
      textureLayers: [],
    },
    objects: [],
    checkpoints: [],
    startLine: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    validation: { isValid: false, issues: [], validatedAt: null },
  };
}
