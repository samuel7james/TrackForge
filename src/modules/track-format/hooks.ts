"use client";

import { useMemo } from "react";
import { useTrackStore } from "@/store/track-store";
import {
  generateCheckpoints,
  generateStartLine,
  type GeneratedCheckpoint,
  type GeneratedStartLine,
} from "./generate-track-elements";
import { validateTrack, type TrackValidationResult } from "./validate-track";

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
  return useMemo(() => validateTrack(spline), [spline]);
}
