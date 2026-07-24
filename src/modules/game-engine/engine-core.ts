// The original reference implementation was one top-level `init()` that
// appends a renderer straight to document.body and starts an uncancellable
// requestAnimationFrame loop, assuming it owns the whole page forever. This
// restructures that into `createEngine(options) -> handle`, so a React
// component (engine-mount.tsx) can construct one per mount and call
// `handle.dispose()` on unmount without leaking the render loop, listeners,
// or GPU resources.
import * as THREE from "three";
import { toast } from "sonner";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LightProbeGrid } from "three/examples/jsm/lighting/LightProbeGrid.js";
import {
  createWorldSettings,
  createWorld,
  addBroadphaseLayer,
  addObjectLayer,
  enableCollision,
  registerAll,
  updateWorld,
  rigidBody,
  box,
  MotionType,
  type World,
  type Listener,
} from "crashcat";
import { Vehicle, MAX_SPEED } from "./vehicle";
import { Camera } from "./camera";
import { Controls } from "./controls";
import { buildTrack, computeSpawnPosition, computeTrackBounds, type Cell, type ModelMap } from "./track";
import { buildWallColliders, createSphereBody } from "./physics";
import { SmokeTrails } from "./particles";
import { DriftMarks } from "./drift-marks";
import { GameAudio } from "./audio";
import { LapTimer } from "./lap-timer";
import { SessionStats } from "./session-stats";
import { GhostRecorder } from "./ghost-recorder";
import { loadGhost, saveGhost, GhostPlayer } from "./ghost-playback";
import { ColorMapGLTFLoader } from "./loader";
import { buildPlacedObjectMeshes, buildPlacedObjectBodies } from "./placed-objects";
import type { PlacedObject } from "@/modules/track-format/schema";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** null/omitted plays the reference's own built-in demo grid. */
  mapCells?: Cell[] | null;
  /** TrackForge's own placed-object layer (cones/barriers/trees/etc.) on
   * top of the tile track -- a feature the reference doesn't have at all. */
  objects?: PlacedObject[];
  /** localStorage key suffix for best-lap/drift-mark persistence. */
  trackId?: string | null;
  /** Whether completed best laps get POSTed to the leaderboard -- true only
   * for a "real play" session (the public track page's autoplay link),
   * never the owner testing their own track from inside the editor, so a
   * leaderboard position can't be inflated by repeat in-editor testing. */
  submitLapTimes?: boolean;
  /** Attached to leaderboard submissions -- always set by the time
   * submitLapTimes is true, since track-editor.tsx gates entering Play
   * mode at all behind DisplayNameGate. */
  displayName?: string | null;
  /** Aborted by engine-mount.tsx if the component unmounts while model
   * loading is still in flight, so createEngine can skip building the rest
   * of the scene/world/vehicle for a mount that's already gone. */
  signal?: AbortSignal;
}

export interface EngineHandle {
  /** Read by hud-overlay.tsx every frame for the lap/time display. */
  lapTimer: LapTimer;
  /** Read by session-stats-panel.tsx every frame for the stats display. */
  sessionStats: SessionStats;
  /** Read/driven by touch-controls-overlay.tsx for the on-screen joystick. */
  controls: Controls;
  dispose(): void;
}

const PLAYER_MODEL = "vehicle-truck-red";

const MODEL_NAMES = [
  "vehicle-truck-red",
  "vehicle-truck-green",
  "vehicle-truck-purple",
  "track-straight",
  "track-corner",
  "track-bump",
  "track-finish",
  "decoration-empty",
  "decoration-forest",
  "decoration-tents",
];

function disposeObject3D(obj: THREE.Object3D) {
  // Skip module-level singleton geometry/material shared across every engine
  // mount (see placed-objects.ts's PROP_REGISTRY-backed meshes) -- disposing
  // those here would free their GPU buffers for every future mount too, not
  // just this one.
  if (obj.userData.sharedResource) return;

  if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
    obj.geometry?.dispose();
    const material = obj.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  }
}

// A semi-transparent clone of the player vehicle, positioned/rotated each
// frame from GhostPlayer's playback (see ghost-playback.ts) rather than
// driven by input/physics. Object3D.clone(true) only deep-clones the
// hierarchy, not materials -- cloning materials explicitly here means
// setting them transparent never affects the real vehicle's own materials,
// which the vehicle's own clone in Vehicle.init() would otherwise share.
function buildGhostMesh(model: THREE.Object3D): THREE.Group {
  const cloned = model.clone(true);
  cloned.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = Array.isArray(child.material)
      ? child.material.map((m) => m.clone())
      : child.material.clone();
    for (const m of Array.isArray(material) ? material : [material]) {
      m.transparent = true;
      m.opacity = 0.35;
      m.depthWrite = false;
    }
    child.material = material;
    child.castShadow = false;
    child.receiveShadow = false;
  });

  const container = new THREE.Group();
  container.add(cloned);
  return container;
}

export async function createEngine(options: EngineOptions): Promise<EngineHandle> {
  const {
    canvas,
    mapCells = null,
    objects = [],
    trackId = null,
    submitLapTimes = false,
    displayName = null,
    signal,
  } = options;
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    outputBufferType: THREE.HalfFloatType,
  });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0, 0, 0);
  bloomPass.strength = 0.02;
  bloomPass.radius = 0.02;
  bloomPass.threshold = 0.5;
  renderer.setEffects([bloomPass]);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xadb2ba);
  scene.fog = new THREE.Fog(0xadb2ba, 30, 55);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.position.set(11.4, 15, -5.3);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.setScalar(4096);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 60;
  dirLight.shadow.radius = 4;
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0xc8d8e8, 0x7a8a5a, 2);
  hemiLight.position.copy(dirLight.position);
  scene.add(hemiLight);

  const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener("resize", handleResize);

  const loader = new ColorMapGLTFLoader();
  const models: ModelMap = {};

  await Promise.all(
    MODEL_NAMES.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          loader.load(
            `/models/${name}.glb`,
            (gltf) => {
              const meshes: THREE.Mesh[] = [];
              gltf.scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  (child.material as THREE.Material).side = THREE.FrontSide;
                  meshes.push(child);
                }
              });

              // Godot imports vehicle models at root_scale=0.5
              if (name.startsWith("vehicle-")) {
                gltf.scene.scale.setScalar(0.5);
              }

              if (meshes.length === 1) {
                const mesh = meshes[0];
                mesh.removeFromParent();
                models[name] = mesh;
              } else {
                models[name] = gltf.scene;
              }

              resolve();
            },
            undefined,
            reject
          );
        })
    )
  );

  if (signal?.aborted) {
    renderer.dispose();
    const controls = new Controls();
    controls.dispose();
    return {
      lapTimer: new LapTimer(null, null),
      sessionStats: new SessionStats(false),
      controls,
      dispose() {},
    };
  }

  const spawn = mapCells ? computeSpawnPosition(mapCells) : null;

  const bounds = computeTrackBounds(mapCells);
  const hw = bounds.halfWidth;
  const hd = bounds.halfDepth;
  const groundSize = Math.max(hw, hd) * 2 + 20;

  const shadowExtent = Math.max(hw, hd) + 10;
  dirLight.shadow.camera.left = -shadowExtent;
  dirLight.shadow.camera.right = shadowExtent;
  dirLight.shadow.camera.top = shadowExtent;
  dirLight.shadow.camera.bottom = -shadowExtent;
  dirLight.shadow.camera.updateProjectionMatrix();

  scene.fog.near = groundSize * 0.4;
  scene.fog.far = groundSize * 0.8;

  buildTrack(scene, models, mapCells);
  buildPlacedObjectMeshes(scene, models, objects);

  const probeHeight = 6;
  const probes = new LightProbeGrid(
    hw * 2,
    probeHeight,
    hd * 2,
    Math.max(4, Math.round(hw / 4)),
    2,
    Math.max(4, Math.round(hd / 4))
  );
  probes.position.set(bounds.centerX, probeHeight / 2, bounds.centerZ);
  probes.bake(renderer, scene, { cubemapSize: 32, near: 0.1, far: groundSize });
  scene.add(probes);

  const worldSettings = createWorldSettings();
  worldSettings.gravity = [0, -9.81, 0];

  const BPL_MOVING = addBroadphaseLayer(worldSettings);
  const BPL_STATIC = addBroadphaseLayer(worldSettings);
  const OL_MOVING = addObjectLayer(worldSettings, BPL_MOVING);
  const OL_STATIC = addObjectLayer(worldSettings, BPL_STATIC);

  enableCollision(worldSettings, OL_MOVING, OL_STATIC);
  enableCollision(worldSettings, OL_MOVING, OL_MOVING);

  registerAll();
  const world: World = createWorld(worldSettings);

  buildWallColliders(world, OL_STATIC, null, mapCells);
  buildPlacedObjectBodies(world, OL_STATIC, OL_MOVING, objects);

  const roadHalf = groundSize / 2;
  rigidBody.create(world, {
    shape: box.create({ halfExtents: [roadHalf, 0.01, roadHalf] }),
    motionType: MotionType.STATIC,
    objectLayer: OL_STATIC,
    position: [bounds.centerX, -0.125, bounds.centerZ],
    friction: 5.0,
    restitution: 0.0,
  });

  const sphereBody = createSphereBody(world, OL_MOVING, spawn ? spawn.position : null);

  const vehicle = new Vehicle();
  vehicle.rigidBody = sphereBody;
  vehicle.physicsWorld = world;

  if (spawn) {
    const [sx, sy, sz] = spawn.position;
    vehicle.spherePos.set(sx, sy, sz);
    vehicle.prevModelPos.set(sx, 0, sz);
    vehicle.container.rotation.y = spawn.angle;
  }

  const vehicleGroup = vehicle.init(models[PLAYER_MODEL]);
  scene.add(vehicleGroup);

  dirLight.target = vehicleGroup;

  const cam = new Camera();
  scene.add(cam.debug);

  const controls = new Controls();

  const particles = new SmokeTrails(scene);
  const driftMarks = new DriftMarks(scene, trackId);

  const audio = new GameAudio();
  audio.init(cam.camera, vehicleGroup);

  const lapTimer = new LapTimer(mapCells, trackId);
  const sessionStats = new SessionStats(lapTimer.enabled);

  const ghostRecorder = new GhostRecorder();
  const ghostPlayer = new GhostPlayer(lapTimer.enabled ? loadGhost(trackId) : null);
  const ghostMesh = lapTimer.enabled ? buildGhostMesh(models[PLAYER_MODEL]) : null;
  if (ghostMesh) {
    ghostMesh.visible = false;
    scene.add(ghostMesh);
  }

  const _forward = new THREE.Vector3();
  const _camLead = new THREE.Vector3();

  const contactListener: Listener = {
    onContactAdded(bodyA, bodyB) {
      if (bodyA !== sphereBody && bodyB !== sphereBody) return;

      _forward.set(0, 0, 1).applyQuaternion(vehicle.container.quaternion);
      _forward.y = 0;
      _forward.normalize();

      const impactVelocity = Math.abs(vehicle.modelVelocity.dot(_forward));
      audio.playImpact(impactVelocity);
    },
  };

  const timer = new THREE.Timer();
  let frameId = 0;
  let prevLap = lapTimer.lap;

  // Shared "a lap just completed" hook -- lapTimer has no event system, just
  // plain fields (see its own comment), so this is the one place that diffs
  // `lapTimer.lap` frame-to-frame, rather than every feature that cares
  // about lap completion (session stats, and later ghost/leaderboard
  // submission) duplicating that diff itself.
  function onLapComplete() {
    if (lapTimer.lastLap !== null) {
      sessionStats.recordLap(Math.round(lapTimer.lastLap * 1000), lapTimer.lastLapWasBest);

      if (lapTimer.lastLapWasBest) {
        const samples = ghostRecorder.getSamples();
        saveGhost(trackId, samples);
        ghostPlayer.setSamples(samples);
      }

      if (submitLapTimes && trackId && displayName) {
        const timeMs = Math.round(lapTimer.lastLap * 1000);
        fetch(`/api/tracks/${trackId}/laptimes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeMs, displayName }),
        })
          .then((res) => res.json())
          .then((data: { isNewPersonalBest?: boolean; worldRecordMs?: number }) => {
            if (data.isNewPersonalBest && data.worldRecordMs === timeMs) {
              toast.success("New world record!");
            } else if (data.isNewPersonalBest) {
              toast.success("New personal best — leaderboard updated");
            }
          })
          .catch(() => {
            // Silent -- a failed leaderboard submission shouldn't interrupt the drive.
          });
      }
    }

    // Start the next lap's recording fresh, win or lose -- the ghost only
    // ever replays the best lap saved above, never the in-progress one.
    ghostRecorder.reset();
  }

  function animate() {
    frameId = requestAnimationFrame(animate);

    timer.update();
    const dt = Math.min(timer.getDelta(), 1 / 30);

    const input = controls.update();

    updateWorld(world, contactListener, dt);

    vehicle.update(dt, input);

    dirLight.position.set(vehicle.spherePos.x + 11.4, 15, vehicle.spherePos.z - 5.3);

    const mv = vehicle.modelVelocity;
    _camLead
      .set(0, 0, 1)
      .applyQuaternion(vehicle.container.quaternion)
      .multiplyScalar(Math.sqrt(mv.x * mv.x + mv.z * mv.z));
    cam.update(dt, vehicle.spherePos, _camLead);
    particles.update(dt, vehicle);
    driftMarks.update(dt, vehicle);
    audio.update(dt, vehicle.linearSpeed / MAX_SPEED, input.z, vehicle.driftIntensity);

    const hasInput = input.touchActive || Math.abs(input.x) > 0.05 || Math.abs(input.z) > 0.05;
    lapTimer.update(dt, vehicle.spherePos, hasInput);
    sessionStats.update(dt, vehicle.linearSpeed / MAX_SPEED);

    if (lapTimer.lap !== prevLap) {
      prevLap = lapTimer.lap;
      onLapComplete();
    }

    if (lapTimer.enabled) {
      ghostRecorder.record(lapTimer.currentLapTime, vehicle.container.position, vehicle.container.quaternion);
    }

    if (ghostMesh) {
      const frame = ghostPlayer.sampleAt(lapTimer.currentLapTime);
      if (frame) {
        ghostMesh.position.copy(frame.position);
        ghostMesh.quaternion.copy(frame.quaternion);
        ghostMesh.visible = true;
      } else {
        ghostMesh.visible = false;
      }
    }

    renderer.render(scene, cam.camera);
  }

  frameId = requestAnimationFrame(animate);

  return {
    lapTimer,
    sessionStats,
    controls,
    dispose() {
      if (disposed) return;
      disposed = true;

      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);

      cam.dispose();
      controls.dispose();
      driftMarks.dispose();
      audio.dispose();

      probes.dispose();
      scene.traverse(disposeObject3D);
      renderer.dispose();
    },
  };
}
