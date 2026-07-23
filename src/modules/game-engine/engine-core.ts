// Adapted from mrdoob/Starter-Kit-Racing's js/main.js (MIT license) -- see
// public/models/THIRD_PARTY_NOTICES.md. The original is one top-level
// `init()` that appends a renderer straight to document.body and starts an
// uncancellable requestAnimationFrame loop, assuming it owns the whole page
// forever. This restructures that into `createEngine(options) -> handle`,
// so a React component (engine-mount.tsx) can construct one per mount and
// call `handle.dispose()` on unmount without leaking the render loop,
// listeners, or GPU resources -- the same "construct a handle, return
// teardown" discipline mode-controller.tsx already applies to Rapier's
// <Physics> tree.
import * as THREE from "three";
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
import { ColorMapGLTFLoader } from "./loader";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** null/omitted plays the reference's own built-in demo grid. */
  mapCells?: Cell[] | null;
  /** localStorage key suffix for best-lap/drift-mark persistence. */
  trackId?: string | null;
}

export interface EngineHandle {
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

export async function createEngine(options: EngineOptions): Promise<EngineHandle> {
  const { canvas, mapCells = null, trackId = null } = options;
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

  if (disposed) {
    renderer.dispose();
    return { dispose() {} };
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

    renderer.render(scene, cam.camera);
  }

  frameId = requestAnimationFrame(animate);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;

      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);

      cam.dispose();
      controls.dispose();
      driftMarks.dispose();
      lapTimer.dispose();
      audio.dispose();

      probes.dispose();
      scene.traverse(disposeObject3D);
      renderer.dispose();
    },
  };
}
