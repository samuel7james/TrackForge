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
import { Vehicle, topSpeedReference } from "./vehicle";
import { Camera } from "./camera";
import { QualityManager } from "./quality-manager";
import { Controls } from "./controls";
import { buildTrack, computeSpawnPosition, computeTrackBounds, encodeCells, TRACK_CELLS, type Cell, type ModelMap } from "./track";
import { buildWallColliders, createSphereBody } from "./physics";
import { SmokeTrails } from "./particles";
import { DriftMarks } from "./drift-marks";
import { GameAudio } from "./audio";
import { LapTimer, clearStoredBestLap } from "./lap-timer";
import { SessionStats } from "./session-stats";
import { GhostRecorder } from "./ghost-recorder";
import { loadGhost, saveGhost, clearGhost, GhostPlayer } from "./ghost-playback";
import { markLapSubmitted, hasSubmittedLap, clearSubmittedLapMark } from "./submitted-lap-marker";
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
  /** Trims several GPU-heavy render settings (shadows, bloom, MSAA, HDR
   * framebuffer, light-probe bake resolution, pixel ratio cap) that cost
   * much more on typical phone GPUs than they're worth there, and switches
   * Controls over to auto-throttle (see Controls.autoThrottle) -- passed in
   * by engine-mount.tsx based on touch-device detection, not screen size,
   * since it's about input mode/hardware class rather than viewport width.
   * Desktop's render path (this flag false) is completely unaffected. The
   * camera is unaffected too -- every device starts on Camera.update and
   * can switch to Camera.updateChase with the C key, regardless of this
   * flag. */
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

// Only what actually gets rendered. vehicle-truck-green and
// vehicle-truck-purple used to be fetched here too, but nothing ever drew
// them -- the player is PLAYER_MODEL and the ghost is a clone of that same
// model -- so they cost every visitor ~182KB of download and GLTF parsing,
// on every platform, to be thrown away. The .glb files are still in
// public/ for whenever car selection wants them.
const MODEL_NAMES = [
  "vehicle-truck-red",
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
    // On now for phones too, where it was previously off. Mobile GPUs are
    // tile-based: they resolve multisampling inside on-chip tile memory,
    // which makes MSAA dramatically cheaper there than the same setting on
    // a desktop immediate-mode GPU, and cheaper than buying equivalent edge
    // quality by pushing the resolution up instead. Jagged edges on
    // long, near-horizontal track boundaries are the single most visible
    // artefact on a phone, and are most of what reads as "pixelated" in
    // landscape, where those edges run the full width of the screen.
    antialias: true,
    // HalfFloatType roughly doubles the color-framebuffer's memory
    // bandwidth requirement over the default 8-bit target -- skip it on
    // mobile, where that bandwidth is the first thing to run out.
    outputBufferType: mobileMode ? undefined : THREE.HalfFloatType,
  });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // Pixel ratio and shadows are both handed to QualityManager below, which
  // sets them from measured frame rate instead of from device class --
  // uncapped devicePixelRatio still means a 3x display renders 9x the
  // pixels of a standard one, but which devices can afford that is a
  // question worth measuring rather than assuming. These are just the
  // opening values it starts from.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileMode ? 1.25 : 2));
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

  // Assigned once the QualityManager exists (it needs the scene, which
  // isn't built yet here) -- a rotation before then is just a resize.
  let onViewportChange: (() => void) | null = null;
  const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    onViewportChange?.();
  };
  window.addEventListener("resize", handleResize);

  // Opened now, in parallel with model loading, so the token is in hand
  // long before any lap could finish and costs no extra wait. It carries
  // the server's timestamp for the elapsed-time check on submission (see
  // lib/lap-session.ts); without it the server has no evidence a race was
  // ever started, so a failure here simply means times don't post.
  const lapSessionRequest: Promise<{ token: string | null; hasRecord: boolean } | null> =
    submitLapTimes && trackId
      ? fetch(`/api/tracks/${trackId}/session`, { method: "POST" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) =>
            data ? { token: data.token ?? null, hasRecord: data.hasRecord === true } : null
          )
          .catch(() => null)
      : Promise.resolve(null);

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

  const lapSession = await lapSessionRequest;
  const lapSessionToken = lapSession?.token ?? null;

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

  // Takes over pixel ratio and shadows from here on, moving between levels
  // to hold the frame rate. A capable phone climbs to full resolution with
  // shadows within a few seconds of the countdown; a struggling machine of
  // any kind steps down instead of stuttering.
  const quality = new QualityManager({
    renderer,
    dirLight,
    scene,
    startLow: mobileMode,
    maxDpr: Math.min(window.devicePixelRatio, 2),
  });
  onViewportChange = () => quality.handleViewportChange();

  const cam = new Camera();
  scene.add(cam.debug);

  // C toggles the heading-relative chase camera (Camera.updateChase) on and
  // off. Its own listener rather than a key in Controls, which is strictly
  // vehicle input (a steer/throttle pair per frame) -- a camera preference
  // isn't that, and unlike driving input it acts on the keydown edge, not on
  // whether the key is held this frame. Deliberately not gated on
  // !mobileMode: a phone has no keyboard to press it with anyway, and a
  // tablet that does have one may as well get the toggle too.
  const handleCameraKey = (e: KeyboardEvent) => {
    // Holding the key down otherwise repeats at the OS key-repeat rate,
    // flipping modes over and over for as long as it's held.
    if (e.code !== "KeyC" || e.repeat) return;
    cam.setChaseMode(!cam.chaseMode);
  };
  window.addEventListener("keydown", handleCameraKey);

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

  // A lap time removed from the leaderboard leaves its ghost behind, since
  // ghosts and best laps are only ever stored in the racer's own browser --
  // there is no server-side copy for an admin's delete to reach. So the
  // deletion is detected here instead: this browser recorded that the
  // leaderboard accepted a time for this exact layout, and the server now
  // says it holds none, which only happens if it was deleted.
  //
  // Both halves of the pairing matter. "No record on the server" alone is
  // also true of someone who only ever tested the track in the editor, and
  // of anyone whose submission failed on the network -- neither of whom
  // should lose a ghost over it. Cleared before LapTimer and GhostPlayer
  // are built below, since both read this storage as they construct.
  if (
    submitLapTimes &&
    trackId &&
    lapSession &&
    !lapSession.hasRecord &&
    hasSubmittedLap(trackId, cellsFingerprint)
  ) {
    clearGhost(trackId, cellsFingerprint);
    clearStoredBestLap(trackId, cellsFingerprint);
    clearSubmittedLapMark(trackId, cellsFingerprint);
  }

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
          body: JSON.stringify({ timeMs, displayName, sessionToken: lapSessionToken }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              if (data?.code === "NEEDS_DISPLAY_NAME") onDisplayNameInvalid?.();
              return;
            }
            // Only on a response the server actually accepted -- this is
            // what later distinguishes "my time was deleted" from "I never
            // had one" (see the invalidation above and its own comment).
            markLapSubmitted(trackId, cellsFingerprint);
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

    // Deliberately fed the raw frame delta, not the clamped `dt` above:
    // that clamp exists to keep physics stable across a stall, but it also
    // caps how slow a frame can *look*, which would hide the exact
    // stuttering this needs to see.
    quality.update(timer.getDelta());

    const input = controls.update();

    updateWorld(world, contactListener, dt);

    vehicle.update(dt, input);

    dirLight.position.set(vehicle.spherePos.x + 11.4, 15, vehicle.spherePos.z - 5.3);

    // Same fixed-azimuth camera on every device by default -- mobile briefly
    // had the chase cam below forced on instead, reverted per explicit
    // request to match desktop's angle. It's now opt-in on any device, per
    // session, via the C key above.
    if (cam.chaseMode) {
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
    // topSpeedReference(), not the nominal MAX_SPEED -- sustained full
    // throttle physically settles just below MAX_SPEED (see its comment in
    // vehicle.ts), so dividing by MAX_SPEED here would mean neither the
    // engine's pitch nor the session-stats percentages could ever actually
    // reach their max/100%. Called per-frame since it tracks the runtime
    // tuning multipliers, which keeps both scales honest at any setting.
    const topSpeed = topSpeedReference();
    audio.update(dt, vehicle.linearSpeed / topSpeed, input.z, vehicle.driftIntensity);

    const hasInput = input.touchActive || Math.abs(input.x) > 0.05 || Math.abs(input.z) > 0.05;
    lapTimer.update(dt, vehicle.spherePos, hasInput);
    sessionStats.update(dt, vehicle.linearSpeed / topSpeed);

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

  // Shaders are otherwise compiled lazily, the first frame each material
  // becomes visible -- so the opening seconds of a drive hitch repeatedly
  // as the track, scenery, car and ghost each come into view and stall the
  // main thread to build their program. Doing it up front moves all of
  // that into the load, where there's already a spinner, and leaves the
  // first laps smooth. It also means the QualityManager's early samples
  // measure rendering rather than compilation, so it stops mistaking
  // compile stalls for a slow GPU and demoting on the strength of them.
  await renderer.compileAsync(scene, cam.camera);

  // Compiling is awaited, so the component can have unmounted meanwhile.
  // Only the loop is withheld -- the fully-formed handle is still returned,
  // and engine-mount.tsx disposes it on arrival (see its `cancelled`
  // branch), which is the one path that already frees everything built
  // above.
  if (!signal?.aborted) frameId = requestAnimationFrame(animate);

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
      window.removeEventListener("keydown", handleCameraKey);

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
