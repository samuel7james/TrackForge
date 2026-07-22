import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import { sampleTerrainHeight } from "@/modules/terrain/heightmap";
import type { RoadSpline, TerrainData, ValidationIssue } from "./schema";

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

const TERRAIN_MISMATCH_METERS = 1.5;
// Checking every sample would be thousands of bilinear lookups on a long
// track for no real benefit -- a mismatch big enough to matter spans many
// samples, so a stride still reliably catches it.
const TERRAIN_CHECK_STRIDE = 8;

// The car's actual driving surface is the sculpted terrain, not the spline
// itself (Phase 12) -- a closed, well-formed loop can still leave the road
// floating above or clipped into terrain that was sculpted after the fact.
// Kept separate from validateTrack (spline-only, unit-testable without a
// terrain fixture); composed together in useTrackValidation.
export function validateTerrainAlignment(
  spline: RoadSpline | undefined,
  terrain: TerrainData
): ValidationIssue[] {
  if (!spline || spline.points.length < 2) return [];

  const samples = sampleRoadCenterline(spline.points, spline.closed);
  for (let i = 0; i < samples.length; i += TERRAIN_CHECK_STRIDE) {
    const sample = samples[i];
    const terrainHeight = sampleTerrainHeight(terrain, sample.position.x, sample.position.z);
    if (Math.abs(terrainHeight - sample.position.y) > TERRAIN_MISMATCH_METERS) {
      return [
        {
          code: "terrain-mismatch",
          message:
            "Terrain doesn't match the road surface in some areas — sculpt it level with the track or the car may clip through it.",
        },
      ];
    }
  }
  return [];
}
