import * as THREE from "three";
import type { Weather } from "@/modules/track-format/schema";

export interface WeatherPreset {
  label: string;
  sunColor: string;
  // Base intensity at full daylight elevation -- scaled down further by how
  // low the sun is (see sunElevationFactor), so a preset's mood and the
  // continuous timeOfDay dial compose rather than fight each other.
  sunIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  ambientIntensity: number;
  // Bottom-to-top gradient stops for SkyDome's canvas texture.
  skyGradient: [string, string, string, string, string, string];
  fogColor: string;
  defaultTimeOfDay: number;
  defaultFogDensity: number;
}

export const WEATHER_PRESETS: Record<Weather, WeatherPreset> = {
  sunny: {
    label: "Clear Day",
    sunColor: "#fff4de",
    sunIntensity: 2.6,
    hemisphereSky: "#8fc7ff",
    hemisphereGround: "#4a4438",
    hemisphereIntensity: 0.8,
    ambientIntensity: 0.35,
    skyGradient: ["#1c5fb0", "#3f86d8", "#66a6e6", "#9cc9f0", "#cfe8fa", "#f0faff"],
    fogColor: "#bcd8ec",
    defaultTimeOfDay: 12,
    // Was 0.006 -- still read hazier than intended on a real built track (the
    // demo track, saved with an even higher 0.02 from earlier iteration,
    // looked washed-out gray rather than crisp and sunny). Lowered further
    // and confirmed by screenshot, not just the formula.
    defaultFogDensity: 0.0035,
  },
  sunset: {
    label: "Sunset",
    sunColor: "#ffb45c",
    sunIntensity: 2.2,
    hemisphereSky: "#8a4f6b",
    hemisphereGround: "#2b2438",
    hemisphereIntensity: 0.7,
    ambientIntensity: 0.25,
    skyGradient: ["#12102a", "#3a2a55", "#8a4f6b", "#e0824f", "#ffb45c", "#ffd9a0"],
    fogColor: "#7a5a6e",
    defaultTimeOfDay: 18,
    defaultFogDensity: 0.012,
  },
  night: {
    label: "Night",
    sunColor: "#aabfff",
    sunIntensity: 0.35,
    hemisphereSky: "#1c2340",
    hemisphereGround: "#0a0a12",
    hemisphereIntensity: 0.35,
    ambientIntensity: 0.12,
    skyGradient: ["#010103", "#050516", "#0a0a26", "#12123a", "#1c1c4a", "#2a2a5c"],
    fogColor: "#05050f",
    defaultTimeOfDay: 0,
    defaultFogDensity: 0.015,
  },
  rain: {
    label: "Rain",
    sunColor: "#c7d3de",
    sunIntensity: 0.9,
    hemisphereSky: "#5b6b78",
    hemisphereGround: "#2a2c2e",
    hemisphereIntensity: 0.55,
    ambientIntensity: 0.35,
    skyGradient: ["#2c333a", "#3a434c", "#48545e", "#576470", "#67737e", "#7a848d"],
    fogColor: "#4a545c",
    defaultTimeOfDay: 13,
    defaultFogDensity: 0.02,
  },
  snow: {
    label: "Snow",
    sunColor: "#e8f0ff",
    sunIntensity: 1.4,
    hemisphereSky: "#c9dced",
    hemisphereGround: "#8a94a0",
    hemisphereIntensity: 0.8,
    ambientIntensity: 0.45,
    skyGradient: ["#8fa3b8", "#a3b6c8", "#b8c9d8", "#cbdae6", "#dde9f2", "#eef4fa"],
    fogColor: "#c3d3e0",
    defaultTimeOfDay: 12,
    defaultFogDensity: 0.022,
  },
  fog: {
    label: "Fog",
    sunColor: "#d8dde2",
    sunIntensity: 0.6,
    hemisphereSky: "#8b929a",
    hemisphereGround: "#5a5f64",
    hemisphereIntensity: 0.6,
    ambientIntensity: 0.4,
    skyGradient: ["#7d8288", "#868b91", "#90959a", "#9aa0a4", "#a5aaae", "#b0b5b8"],
    fogColor: "#9aa0a4",
    defaultTimeOfDay: 9,
    defaultFogDensity: 0.045,
  },
  cloudy: {
    label: "Cloudy",
    sunColor: "#dfe4e8",
    sunIntensity: 1.3,
    hemisphereSky: "#6d7885",
    hemisphereGround: "#3a3d42",
    hemisphereIntensity: 0.6,
    ambientIntensity: 0.32,
    skyGradient: ["#4a5058", "#5a6068", "#6b7178", "#7c8288", "#8e9398", "#a0a4a8"],
    fogColor: "#6b7178",
    defaultTimeOfDay: 14,
    defaultFogDensity: 0.016,
  },
};

export const WEATHER_TYPES = Object.keys(WEATHER_PRESETS) as Weather[];

// Sun elevation from time-of-day (0-24h): sunrise ~6:00, noon ~12:00 (peak),
// sunset ~18:00, midnight ~0/24 (directly below). A continuous dial that
// composes with the discrete weather preset -- any preset dims toward
// darkness near midnight rather than the two systems fighting each other.
export function sunPositionAndFactor(timeOfDay: number): { position: THREE.Vector3; elevationFactor: number } {
  const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
  const distance = 100;
  const elevation = Math.sin(angle);
  const position = new THREE.Vector3(Math.cos(angle) * distance, elevation * distance, -40);
  return { position, elevationFactor: THREE.MathUtils.clamp(elevation, 0.05, 1) };
}
