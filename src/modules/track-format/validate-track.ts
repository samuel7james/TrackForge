import * as THREE from "three";
import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import { safeHalfWidth } from "@/modules/spline/road-mesh";
import { sampleTerrainHeight } from "@/modules/terrain/heightmap";
import { PROP_BLOCKING_RADIUS, isPropType } from "@/modules/objects/prop-registry";
import type { PlacedObject, RoadSpline, TerrainData, ValidationIssue } from "./schema";

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
//
// Checks both road edges, not just the centerline (Phase 16) -- a hill
// sculpted close enough to clear the centerline check can still poke up
// through one side of a wide road, which the centerline alone would miss.
export function validateTerrainAlignment(
  spline: RoadSpline | undefined,
  terrain: TerrainData
): ValidationIssue[] {
  if (!spline || spline.points.length < 2) return [];

  const samples = sampleRoadCenterline(spline.points, spline.closed);
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < samples.length; i += TERRAIN_CHECK_STRIDE) {
    const sample = samples[i];
    const right = new THREE.Vector3().crossVectors(sample.tangent, up).normalize();
    const halfWidth = safeHalfWidth(samples, i, sample.width / 2);

    const checkPoints = [
      sample.position,
      sample.position.clone().addScaledVector(right, -halfWidth),
      sample.position.clone().addScaledVector(right, halfWidth),
    ];

    for (const point of checkPoints) {
      const terrainHeight = sampleTerrainHeight(terrain, point.x, point.z);
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
  }
  return [];
}

// A corner tight enough that the curvature-based width clamp (road-mesh.ts,
// Phase 11) has narrowed it well below its intended width -- reusing the
// exact same safeHalfWidth the visual ribbon and collider already use, so
// this flags precisely the corners that fix was papering over rather than a
// second, potentially-inconsistent notion of "too tight."
const MIN_SAFE_WIDTH_FRACTION = 0.35;

export function validateImpassableCorners(spline: RoadSpline | undefined): ValidationIssue[] {
  if (!spline || spline.points.length < 2) return [];

  const samples = sampleRoadCenterline(spline.points, spline.closed);
  for (let i = 0; i < samples.length; i++) {
    const requestedHalfWidth = samples[i].width / 2;
    const safe = safeHalfWidth(samples, i, requestedHalfWidth);
    if (safe < requestedHalfWidth * MIN_SAFE_WIDTH_FRACTION) {
      return [
        {
          code: "impassable-corner",
          message:
            "A corner is tighter than the road can safely narrow for — space its control points further apart or reduce the road width there.",
        },
      ];
    }
  }
  return [];
}

// Flags a placed object big/close enough to fully span the road's (safe)
// width at its nearest point on the centerline -- a car literally can't get
// past it. Uses each prop type's approximate ground-level footprint radius
// (PROP_BLOCKING_RADIUS), scaled by the object's own scale, not the visual
// footprint of taller parts like a tree's canopy that a car's body would
// never actually touch.
const OBJECT_PROXIMITY_MARGIN = 6; // meters -- skip objects nowhere near the track

export function validateObjectsBlockingPath(
  spline: RoadSpline | undefined,
  objects: PlacedObject[]
): ValidationIssue[] {
  if (!spline || spline.points.length < 2 || objects.length === 0) return [];

  const samples = sampleRoadCenterline(spline.points, spline.closed);
  if (samples.length === 0) return [];
  const up = new THREE.Vector3(0, 1, 0);

  for (const object of objects) {
    if (!isPropType(object.type)) continue;
    const objectPosition = new THREE.Vector3(object.position.x, object.position.y, object.position.z);

    let nearestIndex = 0;
    let nearestDistSq = Infinity;
    samples.forEach((sample, i) => {
      const distSq = sample.position.distanceToSquared(objectPosition);
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestIndex = i;
      }
    });

    const nearestSample = samples[nearestIndex];
    const halfWidth = safeHalfWidth(samples, nearestIndex, nearestSample.width / 2);
    if (Math.sqrt(nearestDistSq) > halfWidth + OBJECT_PROXIMITY_MARGIN) continue;

    const right = new THREE.Vector3().crossVectors(nearestSample.tangent, up).normalize();
    const lateralOffset = objectPosition.clone().sub(nearestSample.position).dot(right);
    const radius = PROP_BLOCKING_RADIUS[object.type] * object.scale.x;

    if (lateralOffset - radius <= -halfWidth && lateralOffset + radius >= halfWidth) {
      return [
        {
          code: "object-blocks-path",
          message: "A placed object spans the full width of the road and blocks the way through — move or shrink it.",
        },
      ];
    }
  }
  return [];
}
