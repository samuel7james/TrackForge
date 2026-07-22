"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { SceneRoot } from "./scene-root";
import { ModeController } from "./mode-controller";

// Mounted once per editor session and never unmounted between editing and
// driving — the mechanism behind the zero-reload Play button (PROJECT_PLAN.md §4).
export function TrackForgeCanvas() {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <Suspense fallback={null}>
        <SceneRoot />
        <ModeController />
      </Suspense>
    </Canvas>
  );
}
