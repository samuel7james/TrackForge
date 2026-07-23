import { trackDocumentV2Schema, type TrackDocumentV2 } from "./schema";

// Boundary validation -- is this JSON shaped like a valid TrackDocumentV2.
// Distinct from the publish route's own minimal checks, which check whether
// a *valid* document describes a *raceable* track (has a finish line,
// etc). Every read/write that crosses the client/server boundary runs
// through here so a malformed or hand-edited payload can't corrupt the
// store or crash the renderer.
export function parseTrackDocument(data: unknown): TrackDocumentV2 {
  return trackDocumentV2Schema.parse(data);
}

export function safeParseTrackDocument(data: unknown) {
  return trackDocumentV2Schema.safeParse(data);
}
