"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { RoadSpline } from "@/modules/track-format/schema";
import { sampleRoadCenterline } from "./catmull-rom";
import { buildCurbGeometry, buildRoadGeometry } from "./road-mesh";

// Subtle procedural asphalt grain — a flat color reads as programmer-art
// from a chase camera close to the surface; a little high-frequency noise
// sells "road" for almost no cost.
function useAsphaltTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#2b2d33";
    ctx.fillRect(0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Deliberate one-shot random noise texture, generated once per mount
      // (empty useMemo deps below), not re-derived on re-render.
      // eslint-disable-next-line react-hooks/purity
      const grain = (Math.random() - 0.5) * 18;
      imageData.data[i] += grain;
      imageData.data[i + 1] += grain;
      imageData.data[i + 2] += grain;
    }
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 24);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

export function Road({ spline }: { spline: RoadSpline }) {
  const asphaltTexture = useAsphaltTexture();
  const { roadGeometry, curbGeometry } = useMemo(() => {
    const samples = sampleRoadCenterline(spline.points, spline.closed);
    return {
      roadGeometry: buildRoadGeometry(samples),
      curbGeometry: buildCurbGeometry(samples),
    };
  }, [spline]);

  if (spline.points.length < 2) return null;

  return (
    <group>
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial map={asphaltTexture} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={curbGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
