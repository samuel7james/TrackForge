import { z } from "zod";
import { TYPE_NAMES, DECO_TYPE_NAMES, GODOT_ORIENTS, type PieceType, type DecoType } from "@/modules/game-engine/track";

// The Track Document — see PROJECT_PLAN.md §7. Only `splines` is populated by
// the Milestone 1 UI; the rest of the shape exists now so later milestones
// (terrain, objects, checkpoints, validation) are additive, not migrations.
//
// formatVersion 2 (below) is NOT an additive migration of formatVersion 1 --
// it replaces the spline/heightmap road-building system with the real
// Starter-Kit-Racing tile-based track format (see modules/game-engine/track.ts),
// which has no algorithmic path back from a heightmap+spline to a tile grid.
// Both versions are validated (validate.ts's discriminated union) so existing
// v1 rows keep reading correctly, but nothing produces new v1 documents once
// the new editor (Phase 5 of the engine-swap work) lands -- v1 is a dead end,
// not a format either version keeps writing.

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

// resolution is vertices-per-side (not cells), so heightmap/weightmap arrays
// are always resolution*resolution -- checked below so a corrupted document
// fails Zod validation at the load boundary (editor-view.tsx) rather than
// producing a mismatched mesh/collider silently.
export const terrainDataSchema = z
  .object({
    size: z.object({ width: z.number(), depth: z.number() }),
    resolution: z.number().int().positive(),
    heightmap: z.array(z.number()),
    textureLayers: z.array(terrainTextureLayerSchema),
  })
  .refine((t) => t.heightmap.length === t.resolution * t.resolution, {
    message: "terrain heightmap length must equal resolution * resolution",
  })
  .refine(
    (t) => t.textureLayers.every((l) => l.weightmap.length === t.resolution * t.resolution),
    { message: "each terrain texture layer's weightmap must match the terrain resolution" }
  );
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

// Shared by both format versions -- a track's name/tags/difficulty and its
// weather/lighting choice are meaningful regardless of how the road itself
// is represented underneath.
export const metaSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  authorId: z.string(),
  // Discovery (Phase 17). Defaults to [] so documents saved before this
  // field existed still parse -- no separate migration step needed.
  tags: z.array(z.string()).default([]),
  difficulty: difficultySchema,
  estimatedLapTimeMs: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrackMeta = z.infer<typeof metaSchema>;

export const environmentSchema = z.object({
  weather: weatherSchema,
  timeOfDay: z.number(),
  fogDensity: z.number(),
});
export type Environment = z.infer<typeof environmentSchema>;

export const validationStateSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(validationIssueSchema),
  validatedAt: z.string().nullable(),
});
export type ValidationState = z.infer<typeof validationStateSchema>;

export const trackDocumentSchema = z.object({
  formatVersion: z.literal(1),
  meta: metaSchema,
  environment: environmentSchema,
  splines: z.array(roadSplineSchema),
  terrain: terrainDataSchema,
  objects: z.array(placedObjectSchema),
  checkpoints: z.array(checkpointSchema),
  startLine: z.object({ position: vec3Schema, rotation: quatSchema }),
  validation: validationStateSchema,
});
export type TrackDocument = z.infer<typeof trackDocumentSchema>;

// ─── formatVersion 2 — tile-based track (see modules/game-engine/track.ts) ───

const godotOrientSchema = z.union(GODOT_ORIENTS.map((o) => z.literal(o)) as [
  z.ZodLiteral<0>,
  z.ZodLiteral<10>,
  z.ZodLiteral<16>,
  z.ZodLiteral<22>,
]);

export const cellSchema = z.tuple([
  z.number().int(),
  z.number().int(),
  z.enum(TYPE_NAMES as [PieceType, ...PieceType[]]),
  godotOrientSchema,
]);

export const decoCellSchema = z.tuple([
  z.number().int(),
  z.number().int(),
  z.enum(DECO_TYPE_NAMES as [DecoType, ...DecoType[]]),
  godotOrientSchema,
]);

export const trackDocumentV2Schema = z.object({
  formatVersion: z.literal(2),
  meta: metaSchema,
  environment: environmentSchema,
  // No checkpoints/startLine: LapTimer derives the spawn point and its
  // required-cell set directly from `cells` (see computeSpawnPosition in
  // modules/game-engine/track.ts) -- storing them separately would just be
  // two sources of truth that could drift.
  track: z.object({
    cells: z.array(cellSchema),
    deco: z.array(decoCellSchema),
  }),
  objects: z.array(placedObjectSchema),
  validation: validationStateSchema,
});
export type TrackDocumentV2 = z.infer<typeof trackDocumentV2Schema>;

const DEFAULT_ROAD_WIDTH = 8;

// Vertices per side of the terrain grid. 65 (64 cells) over a 500x500 world
// keeps each cell a manageable ~7.8m -- coarse enough to sculpt and collide
// with cheaply, fine enough for real hills rather than a handful of facets.
export const TERRAIN_RESOLUTION = 65;
export const TERRAIN_SIZE = 500;

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

export function createFlatTerrain(): TerrainData {
  const cellCount = TERRAIN_RESOLUTION * TERRAIN_RESOLUTION;
  return {
    size: { width: TERRAIN_SIZE, depth: TERRAIN_SIZE },
    resolution: TERRAIN_RESOLUTION,
    heightmap: new Array(cellCount).fill(0),
    // Grass fully weighted everywhere, dirt/rock at zero -- a real starting
    // state (rather than empty arrays) so the terrain always has something
    // valid to render and paint from the first save.
    textureLayers: [
      { type: "grass", weightmap: new Array(cellCount).fill(1) },
      { type: "dirt", weightmap: new Array(cellCount).fill(0) },
      { type: "rock", weightmap: new Array(cellCount).fill(0) },
    ],
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
      tags: [],
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
    terrain: createFlatTerrain(),
    objects: [],
    checkpoints: [],
    startLine: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    validation: { isValid: false, issues: [], validatedAt: null },
  };
}

export function createEmptyTrackDocumentV2(name = "Untitled Track"): TrackDocumentV2 {
  const now = new Date().toISOString();
  return {
    formatVersion: 2,
    meta: {
      id: crypto.randomUUID(),
      slug: "",
      name,
      description: "",
      authorId: "",
      tags: [],
      difficulty: "beginner",
      estimatedLapTimeMs: null,
      createdAt: now,
      updatedAt: now,
    },
    environment: { weather: "sunny", timeOfDay: 12, fogDensity: 0.02 },
    track: { cells: [], deco: [] },
    objects: [],
    validation: { isValid: false, issues: [], validatedAt: null },
  };
}
