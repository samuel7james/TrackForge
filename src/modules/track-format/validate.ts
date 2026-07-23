import { trackDocumentSchema, type TrackDocument } from "./schema";

// Boundary validation -- is this JSON shaped like a valid TrackDocument.
// Distinct from the publish route's own minimal checks, which check whether
// a *valid* document describes a *raceable* track (has a finish line,
// etc). Every read/write that crosses the client/server boundary runs
// through here so a malformed or hand-edited payload can't corrupt the
// store or crash the renderer.
export function parseTrackDocument(data: unknown): TrackDocument {
  return trackDocumentSchema.parse(data);
}

export function safeParseTrackDocument(data: unknown) {
  return trackDocumentSchema.safeParse(data);
}
