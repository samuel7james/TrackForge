"use client";

import { useMemo } from "react";
import { useTrackStore } from "@/store/track-store";
import {
  generateCheckpoints,
  generateStartLine,
  type GeneratedCheckpoint,
  type GeneratedStartLine,
} from "./generate-track-elements";
import {
  validateTrack,
  validateTerrainAlignment,
  validateImpassableCorners,
  validateObjectsBlockingPath,
  type TrackValidationResult,
} from "./validate-track";

// These are derived from splines, not independently stored state, during
// editing -- Phase 8 computes and writes them into the document at save time.

export function useStartLine(): GeneratedStartLine | null {
  const spline = useTrackStore((s) => s.document.splines[0]);
  return useMemo(() => (spline ? generateStartLine(spline) : null), [spline]);
}

export function useCheckpoints(): GeneratedCheckpoint[] {
  const spline = useTrackStore((s) => s.document.splines[0]);
  return useMemo(() => (spline ? generateCheckpoints(spline) : []), [spline]);
}

export function useTrackValidation(): TrackValidationResult {
  const spline = useTrackStore((s) => s.document.splines[0]);
  const terrain = useTrackStore((s) => s.document.terrain);
  const objects = useTrackStore((s) => s.document.objects);
  return useMemo(() => {
    const track = validateTrack(spline);
    const terrainIssues = validateTerrainAlignment(spline, terrain);
    const cornerIssues = validateImpassableCorners(spline);
    const objectIssues = validateObjectsBlockingPath(spline, objects);
    const issues = [...track.issues, ...terrainIssues, ...cornerIssues, ...objectIssues];
    return {
      isValid: issues.length === 0,
      issues,
    };
  }, [spline, terrain, objects]);
}
