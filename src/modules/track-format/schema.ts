import { z } from "zod";
import { TYPE_NAMES, GODOT_ORIENTS, type PieceType } from "@/modules/game-engine/track";

// The Track Document -- tile-based (see modules/game-engine/track.ts). This
// used to be formatVersion 2 alongside a formatVersion 1 (spline/heightmap)
// sibling from TrackForge's original editor; v1 and its entire R3F/Rapier
// rendering stack were deleted once the new tile-based editor replaced it
// (see TASKS.md's "Ad hoc -- Engine Swap" entries) -- there was no
// algorithmic migration path from a heightmap+spline document to a tile
// grid, so this was a hard cutover, not a version bump either format still
// needs to understand.

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

export const placedObjectSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: vec3Schema,
  rotation: quatSchema,
  scale: vec3Schema,
  groupId: z.string().nullable(),
});
export type PlacedObject = z.infer<typeof placedObjectSchema>;

export const validationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

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

export const trackDocumentV2Schema = z.object({
  formatVersion: z.literal(2),
  meta: metaSchema,
  environment: environmentSchema,
  // No checkpoints/startLine: LapTimer derives the spawn point and its
  // required-cell set directly from `cells` (see computeSpawnPosition in
  // modules/game-engine/track.ts) -- storing them separately would just be
  // two sources of truth that could drift. No deco cells either:
  // buildTrack's own procedural hash-ring (modules/game-engine/track.ts)
  // already dresses any custom track's surroundings automatically with zero
  // data needed, and deliberate scenery placement is already covered by
  // `objects` below (the forest/paddock prop types, free-form position
  // rather than grid-locked) -- a separate deco-cell field would just
  // duplicate that with no editor ever meant to populate it.
  track: z.object({
    cells: z.array(cellSchema),
  }),
  objects: z.array(placedObjectSchema),
  validation: validationStateSchema,
});
export type TrackDocumentV2 = z.infer<typeof trackDocumentV2Schema>;

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
    track: { cells: [] },
    objects: [],
    validation: { isValid: false, issues: [], validatedAt: null },
  };
}
