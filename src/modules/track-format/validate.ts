import { z } from "zod";
import { trackDocumentSchema, trackDocumentV2Schema, type TrackDocument, type TrackDocumentV2 } from "./schema";

// Boundary validation -- is this JSON shaped like a valid TrackDocument.
// Distinct from validate-track.ts, which checks whether a *valid* document
// describes a *raceable* track (closed loop, etc). Every read/write that
// crosses the client/server boundary runs through here so a malformed or
// hand-edited payload can't corrupt the store or crash the renderer.
//
// v1 and v2 are validated as a discriminated union (keyed on formatVersion)
// rather than v1 being migrated to v2 -- v2 replaces the spline/heightmap
// road system with a tile-based one with no algorithmic path from one to
// the other (see schema.ts's own comment on this), so existing v1 rows just
// keep parsing as v1 forever. Callers that only make sense for one version
// (the old spline-based editor, the tile-based one once it lands) narrow on
// `.formatVersion` themselves after a successful parse.
const anyTrackDocumentSchema = z.discriminatedUnion("formatVersion", [
  trackDocumentSchema,
  trackDocumentV2Schema,
]);

export function parseTrackDocument(data: unknown): TrackDocument | TrackDocumentV2 {
  return anyTrackDocumentSchema.parse(data);
}

export function safeParseTrackDocument(data: unknown) {
  return anyTrackDocumentSchema.safeParse(data);
}
