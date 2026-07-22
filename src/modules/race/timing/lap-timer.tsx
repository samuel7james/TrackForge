"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { vehicleHandle } from "@/modules/race/vehicle/vehicle-ref";
import { useCheckpoints, useStartLine } from "@/modules/track-format/hooks";
import { useRaceStore } from "@/store/race-store";
import { hasCrossedGate } from "./gate-crossing";

// Checkpoints must be crossed in order before start/finish completes a lap;
// crossing start/finish early (e.g. a shortcut or driving backward) is just
// ignored rather than penalized or resetting anything, keeping Milestone 1's
// timing forgiving. Renders nothing -- purely a per-frame side effect.
export function LapTimer() {
  const startLine = useStartLine();
  const checkpoints = useCheckpoints();

  const resetCurrentLap = useRaceStore((s) => s.resetCurrentLap);
  const startLap = useRaceStore((s) => s.startLap);
  const recordSector = useRaceStore((s) => s.recordSector);
  const completeLap = useRaceStore((s) => s.completeLap);

  const previousPosition = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    resetCurrentLap();
    previousPosition.current = null;
  }, [resetCurrentLap]);

  useFrame(() => {
    const body = vehicleHandle.current;
    if (!body || !startLine) return;

    const t = body.translation();
    const currentPosition = new THREE.Vector3(t.x, t.y, t.z);

    if (!previousPosition.current) {
      previousPosition.current = currentPosition.clone();
      return;
    }
    const previousPos = previousPosition.current;
    const now = performance.now();

    const { nextCheckpointIndex, lapStartTime } = useRaceStore.getState();
    const targetCheckpoint = checkpoints[nextCheckpointIndex];
    if (
      lapStartTime !== null &&
      targetCheckpoint &&
      hasCrossedGate(previousPos, currentPosition, targetCheckpoint)
    ) {
      console.log(`DEBUG sector-${nextCheckpointIndex}-crossed`);
      recordSector(nextCheckpointIndex, now);
    }

    if (hasCrossedGate(previousPos, currentPosition, startLine)) {
      const current = useRaceStore.getState();
      if (current.lapStartTime === null) {
        console.log("DEBUG lap-start");
        startLap(now);
      } else if (current.nextCheckpointIndex >= checkpoints.length) {
        console.log(`DEBUG lap-complete ${now - current.lapStartTime}`);
        completeLap(now);
      } else {
        console.log("DEBUG start-finish-crossed-early-ignored");
      }
    }

    previousPosition.current.copy(currentPosition);
  });

  return null;
}
