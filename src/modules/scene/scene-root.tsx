"use client";

import { useMemo } from "react";
import { Grid } from "@react-three/drei";
import { useTrackStore } from "@/store/track-store";
import { PlacedObjects } from "@/modules/objects/placed-objects";
import { WEATHER_PRESETS, sunPositionAndFactor } from "@/modules/environment/weather-presets";
import { CELL_RAW, GRID_SCALE } from "@/modules/game-engine/track";
import { TileTrackRenderer } from "./tile-track-renderer";
import { SkyDome } from "./sky-dome";
import { PresenceCursors } from "@/modules/editor/collab/presence-cursors";

const CELL_WORLD_SIZE = CELL_RAW * GRID_SCALE;

// Sky/fog/lighting for the editor's own Canvas -- the track itself renders
// via TileTrackRenderer. No TrackMarkers -- the lap timer's start point is
// derived directly from the finish cell (see computeSpawnPosition in
// modules/game-engine/track.ts) at Play time, there being no separate
// startLine field to visualize.
export function SceneRoot() {
  const environment = useTrackStore((s) => s.document.environment);
  const objects = useTrackStore((s) => s.document.objects);

  const preset = WEATHER_PRESETS[environment.weather];
  const { position: sunPosition, elevationFactor } = useMemo(
    () => sunPositionAndFactor(environment.timeOfDay),
    [environment.timeOfDay]
  );
  const sunIntensity = preset.sunIntensity * elevationFactor;

  // The editor's OrbitControls allow zooming out to 120 units (see
  // editor-camera-rig.tsx) to see a whole track while building it --
  // exponential fog's opacity grows with distance squared, so a
  // fogDensity tuned to look right at Play's much closer chase-cam range
  // (engine-core.ts sets its own separate, unrelated fog) turns almost
  // fully opaque well before max zoom for any but the lightest weather
  // presets. Capped here, editor-only, so editing stays usable regardless
  // of the track's chosen weather -- Play itself is unaffected, it never
  // reads this component's fog at all.
  const editorFogDensity = Math.min(environment.fogDensity, 0.008);

  return (
    <>
      <fogExp2 attach="fog" args={[preset.fogColor, editorFogDensity]} />
      <SkyDome gradient={preset.skyGradient} />

      <hemisphereLight
        args={[preset.hemisphereSky, preset.hemisphereGround, preset.hemisphereIntensity]}
      />
      <ambientLight intensity={preset.ambientIntensity} />
      <directionalLight
        position={sunPosition}
        intensity={sunIntensity}
        color={preset.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.13, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#328260" />
      </mesh>

      <Grid
        position={[0, -0.12, 0]}
        args={[500, 500]}
        cellSize={CELL_WORLD_SIZE}
        cellThickness={0.75}
        cellColor="#1a4a36"
        sectionSize={CELL_WORLD_SIZE * 4}
        sectionThickness={1}
        sectionColor="#1a4a36"
        fadeDistance={150}
        fadeStrength={1}
        infiniteGrid
      />

      <TileTrackRenderer />
      <PlacedObjects objects={objects} />
      <PresenceCursors />
    </>
  );
}
