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
import { Vehicle, TOP_SPEED_REFERENCE } from "./vehicle";
import { Camera } from "./camera";
import { Controls } from "./controls";
import { buildTrack, computeSpawnPosition, computeTrackBounds, encodeCells, TRACK_CELLS, type Cell, type ModelMap } from "./track";
import { buildWallColliders, createSphereBody } from "./physics";
import { SmokeTrails } from "./particles";
import { DriftMarks } from "./drift-marks";
import { GameAudio } from "./audio";
import { LapTimer } from "./lap-timer";
import { SessionStats } from "./session-stats";
import { GhostRecorder } from "./ghost-recorder";
import { loadGhost, saveGhost, GhostPlayer } from "./ghost-playback";
import { ColorMapGLTFLoader } from "./loader";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** null/omitted plays the reference's own built-in demo grid. */
  mapCells?: Cell[] | null;
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
  /** Switches to a close, heading-relative third-person chase camera (see
   * Camera.updateChase) instead of the default fixed-azimuth view, and
   * trims several GPU-heavy render settings (shadows, bloom, MSAA, HDR
   * framebuffer, light-probe bake resolution, pixel ratio cap) that cost
   * much more on typical phone GPUs than they're worth there -- passed in
   * by engine-mount.tsx based on touch-device detection, not screen size,
   * since it's about input mode/hardware class rather than viewport width.
   * Desktop's render path (this flag false) is completely unaffected. */
  mobileMode?: boolean;
  /** Called if a lap-time submission comes back rejected for having no
   * active display-name claim (see laptimes/route.ts's NEEDS_DISPLAY_NAME) --
   * the stored name is stale (an admin removed the claim, or it predates
   * the claim system), so the parent clears it and re-gates the next Play
   * session behind DisplayNameGate rather than continuing to submit under
   * a name that no longer resolves to anyone. */
  onDisplayNameInvalid?: () => void;
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
  /** Read by mini-map.tsx every frame for the live position marker -- the
   * same mutated-in-place THREE objects the render loop itself updates,
   * not a snapshot, so the minimap doesn't need its own physics/position
   * tracking. */
  vehiclePosition: THREE.Vector3;
  vehicleQuaternion: THREE.Quaternion;
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
    trackId = null,
    submitLapTimes = false,
    displayName = null,
    onDisplayNameInvalid,
    mobileMode = false,
    signal,
  } = options;
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // MSAA roughly doubles fragment-shader work on top of an already
    // HDR-framebuffer'd, bloom-passed, shadow-mapped scene -- a real cost on
    // typical phone GPUs for an effect that's hard to even notice next to a
    // moving car. Desktop keeps it since that's not where the budget is
    // tight.
    antialias: !mobileMode,
    // HalfFloatType roughly doubles the color-framebuffer's memory
    // bandwidth requirement over the default 8-bit target -- skip it on
    // mobile, where that bandwidth is the first thing to run out.
    outputBufferType: mobileMode ? undefined : THREE.HalfFloatType,
  });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // Uncapped devicePixelRatio means a 3x-scaled phone/laptop display
  // renders (and runs the bloom pass on) 9x the pixels of a standard
  // display for no visible benefit past ~2x -- the single biggest lever
  // for "runs fine on my machine, chugs on someone else's." Capped further
  // still on mobile, where the GPU behind those extra pixels is usually
  // the weaker one, not the stronger one.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileMode ? 1.5 : 2));
  // Real-time shadow mapping means an extra full-scene depth pass every
  // frame (plus PCF-soft filtering) on top of everything else -- one of the
  // single most expensive toggles on an old/integrated mobile GPU, for a
  // detail most players moving at speed never consciously notice.
  renderer.shadowMap.enabled = !mobileMode;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  if (!mobileMode) {
    // Bloom's own bright-pass extraction + multi-mip blur passes are a full
    // extra render pipeline stage, run every frame, for a strength (0.02)
    // subtle enough to barely register -- not a reasonable trade on mobile.
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0, 0, 0);
    bloomPass.strength = 0.02;
    bloomPass.radius = 0.02;
    bloomPass.threshold = 0.5;
    renderer.setEffects([bloomPass]);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xadb2ba);
  scene.fog = new THREE.Fog(0xadb2ba, 30, 55);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.position.set(11.4, 15, -5.3);
  dirLight.castShadow = !mobileMode;
  // 4096 was 4x the shadow-render cost of 2048 for a difference only
  // visible pixel-peeping at a standstill -- not worth it on lower-end
  // GPUs, especially combined with the PCF-soft radius below.
  dirLight.shadow.mapSize.setScalar(2048);
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
      vehiclePosition: new THREE.Vector3(),
      vehicleQuaternion: new THREE.Quaternion(),
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

  const probeHeight = 6;
  // Baking is a one-time load-time cost (one cubemap render per probe cell),
  // not a per-frame one, but it's still real work to sit through on a slow
  // mobile GPU before the very first frame -- a coarser grid at a smaller
  // cubemap resolution cuts that load-time cost substantially for a lighting
  // difference that's subtle even on desktop.
  const probes = new LightProbeGrid(
    hw * 2,
    probeHeight,
    hd * 2,
    Math.max(mobileMode ? 2 : 4, Math.round(hw / (mobileMode ? 6 : 4))),
    2,
    Math.max(mobileMode ? 2 : 4, Math.round(hd / (mobileMode ? 6 : 4)))
  );
  probes.position.set(bounds.centerX, probeHeight / 2, bounds.centerZ);
  probes.bake(renderer, scene, { cubemapSize: mobileMode ? 16 : 32, near: 0.1, far: groundSize });
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

  // autoThrottle: touch has no gas button (see touch-controls-overlay.tsx)
  // -- once true, Controls.update() drives the car forward on its own
  // unless the brake button is held.
  const controls = new Controls(mobileMode);

  const particles = new SmokeTrails(scene);
  const driftMarks = new DriftMarks(scene, trackId);

  const audio = new GameAudio();
  audio.init(cam.camera, vehicleGroup);

  // A best lap/ghost recorded before the owner edited this track's layout
  // is meaningless against the new one (different corners, different
  // possible route) -- keying local storage off the layout itself, not
  // just trackId, means an edit naturally starts fresh instead of
  // resurfacing a stale time/ghost that no longer matches what's on track.
  const cellsFingerprint = encodeCells(mapCells || TRACK_CELLS);

  const lapTimer = new LapTimer(mapCells, trackId, cellsFingerprint);
  const sessionStats = new SessionStats(lapTimer.enabled);

  const ghostRecorder = new GhostRecorder();
  const ghostPlayer = new GhostPlayer(
    lapTimer.enabled ? loadGhost(trackId, cellsFingerprint) : null
  );
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
        saveGhost(trackId, cellsFingerprint, samples);
        ghostPlayer.setSamples(samples);
      }

      if (submitLapTimes && trackId && displayName) {
        const timeMs = Math.round(lapTimer.lastLap * 1000);
        fetch(`/api/tracks/${trackId}/laptimes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeMs, displayName }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              if (data?.code === "NEEDS_DISPLAY_NAME") onDisplayNameInvalid?.();
              return;
            }
            // Default toast position is bottom-right (see layout.tsx's
            // <Toaster>) -- exactly where the steer-right button lives on
            // touch (touch-controls-overlay.tsx), so a toast popping up
            // mid-corner silently ate the touches meant for that button.
            // Overridden per-call rather than changing the site-wide
            // default, which every other (non-driving) toast still wants.
            const toastOptions = mobileMode ? { position: "top-center" as const } : undefined;
            if (data.isNewPersonalBest && data.worldRecordMs === timeMs) {
              toast.success("New world record!", toastOptions);
            } else if (data.isNewPersonalBest) {
              toast.success("New personal best — leaderboard updated", toastOptions);
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

    if (mobileMode) {
      cam.updateChase(dt, vehicle.spherePos, vehicle.container.quaternion);
    } else {
      const mv = vehicle.modelVelocity;
      _camLead
        .set(0, 0, 1)
        .applyQuaternion(vehicle.container.quaternion)
        .multiplyScalar(Math.sqrt(mv.x * mv.x + mv.z * mv.z));
      cam.update(dt, vehicle.spherePos, _camLead);
    }
    particles.update(dt, vehicle);
    driftMarks.update(dt, vehicle);
    // TOP_SPEED_REFERENCE, not the nominal MAX_SPEED -- sustained full
    // throttle physically settles just below MAX_SPEED (see its comment in
    // vehicle.ts), so dividing by MAX_SPEED here would mean neither the
    // engine's pitch nor the session-stats percentages could ever actually
    // reach their max/100%.
    audio.update(dt, vehicle.linearSpeed / TOP_SPEED_REFERENCE, input.z, vehicle.driftIntensity);

    const hasInput = input.touchActive || Math.abs(input.x) > 0.05 || Math.abs(input.z) > 0.05;
    lapTimer.update(dt, vehicle.spherePos, hasInput);
    sessionStats.update(dt, vehicle.linearSpeed / TOP_SPEED_REFERENCE);

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
    vehiclePosition: vehicle.spherePos,
    vehicleQuaternion: vehicle.container.quaternion,
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
