"use client";

import { useMemo } from "react";
import { Grid } from "@react-three/drei";
import { useTrackStoreV2 } from "@/store/track-store-v2";
import { PlacedObjects } from "@/modules/objects/placed-objects";
import { WEATHER_PRESETS, sunPositionAndFactor } from "@/modules/environment/weather-presets";
import { CELL_RAW, GRID_SCALE } from "@/modules/game-engine/track";
import { TileTrackRenderer } from "./tile-track-renderer";
import { SkyDome } from "./sky-dome";

const CELL_WORLD_SIZE = CELL_RAW * GRID_SCALE;

// Parallel to scene-root.tsx (v1) for the tile-based editor -- sky/fog/
// lighting reuse the exact same weather-preset system (environment is
// identical in shape between both TrackDocument versions), but the track
// itself renders via TileTrackRenderer instead of Road/Terrain, and
// PlacedObjects is handed this store's objects explicitly instead of
// reading the v1 store it defaults to. No TrackMarkers -- the v2 lap
// timer's start point is derived directly from the finish cell (see
// computeSpawnPosition in modules/game-engine/track.ts) at Play time, there
// being no separate startLine field to visualize.
export function SceneRootV2() {
  const environment = useTrackStoreV2((s) => s.document.environment);
  const objects = useTrackStoreV2((s) => s.document.objects);

  const preset = WEATHER_PRESETS[environment.weather];
  const { position: sunPosition, elevationFactor } = useMemo(
    () => sunPositionAndFactor(environment.timeOfDay),
    [environment.timeOfDay]
  );
  const sunIntensity = preset.sunIntensity * elevationFactor;

  return (
    <>
      <fogExp2 attach="fog" args={[preset.fogColor, environment.fogDensity]} />
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
    </>
  );
}
