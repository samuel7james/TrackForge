"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Suspense } from "react";
import { SceneRoot } from "./scene-root";
import { ModeController } from "./mode-controller";

// Mounted once per editor session and never unmounted between editing and
// driving — the mechanism behind the zero-reload Play button (PROJECT_PLAN.md §4).
//
// ACESFilmic tone mapping gives the scene the same filmic highlight rolloff
// the mrdoob reference has out of the box -- r3f's Canvas defaults to no
// tone mapping at all otherwise, which reads flatter by comparison. No
// exposure boost: tried 1.15 first, and combined with this scene's fog (a
// large, uniformly bright sky-colored surface at typical fog densities) it
// pushed huge swaths of the foggy background over the bloom threshold,
// reading as a milky haze over the whole scene rather than the intended
// selective highlight glow -- confirmed by screenshot, not just a hunch.
// luminanceThreshold sits high enough that only genuinely bright, small
// features (emissive headlights/taillights, the sun disc) bloom.
export function TrackForgeCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <Suspense fallback={null}>
        <SceneRoot />
        <ModeController />
        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={0.97}
            luminanceSmoothing={0.15}
            intensity={0.4}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.15} darkness={0.5} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
