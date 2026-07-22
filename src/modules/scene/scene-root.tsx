"use client";

import { Grid } from "@react-three/drei";
import { useTrackStore } from "@/store/track-store";
import { Road } from "@/modules/spline/road";
import { Terrain } from "@/modules/terrain/terrain";
import { PlacedObjects } from "@/modules/objects/placed-objects";
import { TrackMarkers } from "./track-markers";
import { SkyDome } from "./sky-dome";

const SUN_POSITION: [number, number, number] = [80, 22, -40];

// Renders the track document as a scene — the one part of the app that both
// the editor and Play mode mount unchanged (see PROJECT_PLAN.md §4).
//
// Sky is a custom gradient dome (SkyDome), not an HDRI Environment preset —
// those fetch from a third-party CDN at runtime, an unnecessary external
// dependency for basic scene lighting that can silently fail (verified: no
// network path to it at all in this dev sandbox). drei's <Sky> shader was
// also tried and rendered solid black here for reasons not worth chasing
// further; the gradient dome uses the same reliable canvas-texture approach
// already used elsewhere in this codebase (curb striping, asphalt grain).
export function SceneRoot() {
  const splines = useTrackStore((s) => s.document.splines);

  return (
    <>
      <fog attach="fog" args={["#2a2436", 50, 220]} />
      <SkyDome />

      <hemisphereLight args={["#8fa3c9", "#2b2438", 0.7]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={SUN_POSITION}
        intensity={2.4}
        color="#ffddb0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <Terrain />

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
      <PlacedObjects />
      <TrackMarkers />
    </>
  );
}
