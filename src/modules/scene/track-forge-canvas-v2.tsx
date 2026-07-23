"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Suspense } from "react";
import { SceneRootV2 } from "./scene-root-v2";
import { EditorCameraRig } from "./editor-camera-rig";
import { EditorEngineV2 } from "@/modules/editor/core/editor-engine-v2";

// Parallel to track-forge-canvas.tsx (v1) for the tile-based editor -- only
// ever renders the edit-mode subtree (EditorCameraRig + EditorEngineV2).
// Unlike v1, Play mode isn't a sibling inside this same Canvas: a v2
// document's Play session is the vendored engine (engine-mount.tsx), which
// owns its own raw <canvas>/WebGLRenderer entirely outside React Three
// Fiber, so editor-view-v2.tsx swaps this whole component out for
// <EngineMount/> on mode toggle rather than switching a child within it.
export function TrackForgeCanvasV2() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <Suspense fallback={null}>
        <SceneRootV2 />
        <EditorCameraRig />
        <EditorEngineV2 />
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={0.97} luminanceSmoothing={0.15} intensity={0.4} mipmapBlur />
          <Vignette eskil={false} offset={0.15} darkness={0.5} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
