import type { RoadSpline, ValidationIssue } from "./schema";

export interface TrackValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

const MIN_POINTS = 3;

// Business-logic validation of the track LAYOUT (is it a raceable circuit) --
// distinct from Zod schema validation (is this JSON shaped correctly, which
// lives in track-format/validate.ts once Phase 8 needs it at the save/load
// boundary). A single continuous spline can't have unreachable sections or
// out-of-order checkpoints in Milestone 1 (those are generated in arc-length
// order), so "closed loop" + "enough points" is the whole check for now.
export function validateTrack(spline: RoadSpline | undefined): TrackValidationResult {
  const issues: ValidationIssue[] = [];

  if (!spline || spline.points.length === 0) {
    issues.push({
      code: "no-track",
      message: "Add control points to start building a track.",
    });
    return { isValid: false, issues };
  }

  if (spline.points.length < MIN_POINTS) {
    issues.push({
      code: "too-few-points",
      message: `Add at least ${MIN_POINTS} points to form a track (currently ${spline.points.length}).`,
    });
  }

  if (!spline.closed) {
    issues.push({
      code: "not-closed",
      message: "Close the loop so the track forms a complete lap.",
    });
  }

  return { isValid: issues.length === 0, issues };
}
