"use client";

import * as THREE from "three";
import { useMemo } from "react";

// A custom vertical-gradient sky sphere rather than drei's <Sky> (a
// Preetham atmosphere shader, which rendered solid black in this setup for
// reasons not worth chasing further) or an HDRI Environment preset (fetches
// from a third-party CDN at runtime -- verified no network path to it at
// all in this dev sandbox). A gradient dome uses the same reliable
// canvas-texture approach already used elsewhere (curb striping, asphalt
// grain) and needs no external asset.
//
// Scale is deliberately modest (180, not the 800+ a "true" skybox radius
// would suggest) -- at large scale + this project's near/far camera planes,
// the mesh silently failed to render (a depth precision issue serious
// enough to push its fragments outside the representable range). 180 is
// comfortably past the grid's own fade distance (150) while staying well
// inside the range that renders correctly.
// Six bottom-to-top stops -- matches WeatherPreset.skyGradient (Phase 14),
// so each weather preset paints its own mood onto the same dome geometry.
function useSkyGradientTexture(stops: readonly [string, string, string, string, string, string]) {
  return useMemo(() => {
    const width = 2;
    const height = 256;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, stops[0]);
    gradient.addColorStop(0.35, stops[1]);
    gradient.addColorStop(0.55, stops[2]);
    gradient.addColorStop(0.7, stops[3]);
    gradient.addColorStop(0.85, stops[4]);
    gradient.addColorStop(1, stops[5]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [stops]);
}

interface SkyDomeProps {
  gradient: readonly [string, string, string, string, string, string];
}

export function SkyDome({ gradient }: SkyDomeProps) {
  const texture = useSkyGradientTexture(gradient);

  return (
    <mesh scale={180}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} />
    </mesh>
  );
}
