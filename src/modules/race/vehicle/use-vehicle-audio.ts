"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { GameAudio } from "@/modules/audio/game-audio";
import { vehicleVisualState } from "./vehicle-visual-state";
import { MAX_FORWARD_SPEED } from "./use-vehicle-controller";

// Normalizes vehicleVisualState.lateralSlip (real m/s the grip model damped
// out this physics step) into the 0..2ish "driftIntensity" range GameAudio's
// skid thresholds expect -- tuned empirically by driving and logging actual
// slip values, not ported from Starter-Kit-Racing's own arbitrary "sphere
// units" scale, which has no correspondence to this controller's real speeds.
const SLIP_TO_DRIFT_INTENSITY = 2.2;

// Owns one GameAudio instance for exactly as long as `target` is mounted --
// Vehicle remounts fresh every time Play mode starts (ModeController), so
// this hook's effect creates and disposes a GameAudio in step with that,
// rather than leaking worklet nodes/listeners across repeated sessions.
export function useVehicleAudio(targetRef: RefObject<THREE.Object3D | null>) {
  const camera = useThree((s) => s.camera);
  const gameAudioRef = useRef<GameAudio | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const audio = new GameAudio();
    audio.init(camera, target);
    gameAudioRef.current = audio;

    return () => {
      audio.dispose();
      gameAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useFrame((_, delta) => {
    const audio = gameAudioRef.current;
    if (!audio) return;

    const speed01 = vehicleVisualState.forwardSpeed / MAX_FORWARD_SPEED;
    const driftIntensity = vehicleVisualState.lateralSlip * SLIP_TO_DRIFT_INTENSITY;
    audio.update(delta, speed01, vehicleVisualState.throttleInput, driftIntensity);
  });

  return {
    playImpact: (velocity: number) => gameAudioRef.current?.playImpact(velocity),
  };
}
