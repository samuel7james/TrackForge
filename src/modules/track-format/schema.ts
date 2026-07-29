import { z } from "zod";
import { TYPE_NAMES, GODOT_ORIENTS, type PieceType } from "@/modules/game-engine/track";

// The Track Document -- tile-based (see modules/game-engine/track.ts).

// Nothing here was bounded before, which made every field an open-ended
// write into Postgres: a hand-rolled POST to /api/tracks could store a
// document with millions of cells or a megabyte-long description, and the
// GET route would then serve it back to every visitor. These caps are the
// real limit on what a track can cost the database.
//
// All of them are set far above anything the editor can actually produce
// (the largest track on record is 26 cells / 2.4KB), so they reject abuse
// without rejecting a single real document -- which matters because this
// same schema parses on *read* too, so a cap set below existing data would
// make those tracks unopenable rather than merely unsavable.
const MAX_CELLS = 5000;
const MAX_OBJECTS = 2000;
const MAX_NAME = 100;
const MAX_DESCRIPTION = 2000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_ID = 100;
const MAX_ISSUE_TEXT = 500;

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
  id: z.string().max(MAX_ID),
  type: z.string().max(MAX_ID),
  position: vec3Schema,
  rotation: quatSchema,
  scale: vec3Schema,
  groupId: z.string().max(MAX_ID).nullable(),
});
export type PlacedObject = z.infer<typeof placedObjectSchema>;

export const validationIssueSchema = z.object({
  code: z.string().max(MAX_ID),
  message: z.string().max(MAX_ISSUE_TEXT),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const metaSchema = z.object({
  id: z.string().max(MAX_ID),
  slug: z.string().max(MAX_ID),
  name: z.string().max(MAX_NAME),
  description: z.string().max(MAX_DESCRIPTION),
  authorId: z.string().max(MAX_ID),
  // Discovery (Phase 17). Defaults to [] so documents saved before this
  // field existed still parse -- no separate migration step needed.
  tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_TAGS).default([]),
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
  issues: z.array(validationIssueSchema).max(MAX_TAGS),
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

export const trackDocumentSchema = z.object({
  formatVersion: z.literal(2),
  meta: metaSchema,
  environment: environmentSchema,
  // No checkpoints/startLine: LapTimer derives the spawn point and its
  // required-cell set directly from `cells` (see computeSpawnPosition in
  // modules/game-engine/track.ts) -- storing them separately would just be
  // two sources of truth that could drift. No deco cells either:
  // buildTrack's own procedural hash-ring (modules/game-engine/track.ts)
  // already dresses any custom track's surroundings automatically with zero
  // data needed, and deliberate scenery placement was covered by `objects`
  // below -- a separate deco-cell field would just duplicate that.
  track: z.object({
    cells: z.array(cellSchema).max(MAX_CELLS),
  }),
  // The "Object tool" (cones/barriers/trees/rocks/flags/forest/paddock --
  // see git history for prop-registry.ts and game-engine/placed-objects.ts)
  // was removed from the editor and Play-mode rendering to simplify the
  // app down to just track-building for now, kept for a future
  // reimplementation rather than deleted outright. The field stays in the
  // schema (not made optional/dropped) so any already-saved document with
  // real placed objects still parses correctly and that data isn't
  // silently lost -- it just doesn't render or get added to anywhere
  // right now.
  objects: z.array(placedObjectSchema).max(MAX_OBJECTS),
  validation: validationStateSchema,
});
export type TrackDocument = z.infer<typeof trackDocumentSchema>;

// Exported so the publish route can reject this exact placeholder rather
// than letting it collide silently with every other track someone forgot
// to rename before publishing.
export const DEFAULT_TRACK_NAME = "Untitled Track";

export function createEmptyTrackDocument(name = DEFAULT_TRACK_NAME): TrackDocument {
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
