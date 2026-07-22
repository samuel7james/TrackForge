import { trackDocumentSchema, type TrackDocument } from "./schema";

// Boundary validation -- is this JSON shaped like a valid TrackDocument.
// Distinct from validate-track.ts, which checks whether a *valid* document
// describes a *raceable* track (closed loop, etc). Every read/write that
// crosses the client/server boundary runs through here so a malformed or
// hand-edited payload can't corrupt the store or crash the renderer.
//
// formatVersion is always 1 today, so there's nothing to migrate yet --
// when v2 exists, an ordered array of v(n) -> v(n+1) transforms slots in
// here before the schema parse.
export function parseTrackDocument(data: unknown): TrackDocument {
  return trackDocumentSchema.parse(data);
}

export function safeParseTrackDocument(data: unknown) {
  return trackDocumentSchema.safeParse(data);
}
