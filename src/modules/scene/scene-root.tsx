"use client";

import { Grid } from "@react-three/drei";
import { useTrackStore } from "@/store/track-store";
import { Road } from "@/modules/spline/road";

// Renders the track document as a scene — the one part of the app that both
// the editor and Play mode mount unchanged (see PROJECT_PLAN.md §4).
export function SceneRoot() {
  const splines = useTrackStore((s) => s.document.splines);

  return (
    <>
      <color attach="background" args={["#0b0b10"]} />
      <fog attach="fog" args={["#0b0b10", 60, 220]} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[24, 32, 12]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#1c1f26" />
      </mesh>

      <Grid
        position={[0, 0.01, 0]}
        args={[500, 500]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#2a2e38"
        sectionSize={20}
        sectionThickness={1}
        sectionColor="#3d4453"
        fadeDistance={150}
        fadeStrength={1}
        infiniteGrid
      />

      {splines.map((spline) => (
        <Road key={spline.id} spline={spline} />
      ))}
    </>
  );
}
