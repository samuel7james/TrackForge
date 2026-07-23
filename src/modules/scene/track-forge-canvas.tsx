"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Suspense } from "react";
import { SceneRoot } from "./scene-root";
import { EditorCameraRig } from "./editor-camera-rig";
import { EditorEngine } from "@/modules/editor/core/editor-engine";

// Only ever renders the edit-mode subtree (EditorCameraRig + EditorEngine).
// Play mode isn't a sibling inside this same Canvas: a track's Play session
// is the vendored engine (engine-mount.tsx), which owns its own raw
// <canvas>/WebGLRenderer entirely outside React Three Fiber, so
// track-editor.tsx swaps this whole component out for <EngineMount/> on
// mode toggle rather than switching a child within it.
export function TrackForgeCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <Suspense fallback={null}>
        <SceneRoot />
        <EditorCameraRig />
        <EditorEngine />
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={0.97} luminanceSmoothing={0.15} intensity={0.4} mipmapBlur />
          <Vignette eskil={false} offset={0.15} darkness={0.5} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
